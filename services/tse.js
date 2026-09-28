const zlib = require("zlib");

const CKAN_PACKAGE_URL =
  "https://dadosabertos.tse.jus.br/api/3/action/package_show";
const DEFAULT_TSE_YEAR = 2022;
const MAX_ZIP_BYTES = Number(process.env.TSE_MAX_ZIP_BYTES || 15 * 1024 * 1024);
const candidateCache = new Map();
const assetsCache = new Map();

class TSEDatasetTooLargeError extends Error {
  constructor({ ano, totalBytes }) {
    super(`TSE dataset ${ano} is too large for live loading.`);
    this.name = "TSEDatasetTooLargeError";
    this.ano = ano;
    this.totalBytes = totalBytes;
  }
}

function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function limparValor(valor) {
  const texto = String(valor || "").trim();

  if (!texto || texto === "#NULO#" || texto === "-1") {
    return "";
  }

  return texto;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ";" && !inQuotes) {
      values.push(limparValor(current));
      current = "";
      continue;
    }

    current += char;
  }

  values.push(limparValor(current));
  return values;
}

function parseCsv(buffer) {
  const content = buffer.toString("latin1");
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  const headers = parseCsvLine(lines.shift() || "");

  return lines.map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((record, header, index) => {
      record[header] = values[index] || "";
      return record;
    }, {});
  });
}

function extractZipEntries(buffer) {
  const entries = [];
  let offset = 0;

  while (offset < buffer.length - 4 && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const contentStart = nameStart + fileNameLength + extraLength;
    const name = buffer.slice(nameStart, nameStart + fileNameLength).toString("utf8");
    const compressed = buffer.slice(contentStart, contentStart + compressedSize);

    if (method === 0 || method === 8) {
      entries.push({
        name,
        content: method === 8 ? zlib.inflateRawSync(compressed) : compressed,
      });
    }

    offset = contentStart + compressedSize;
  }

  return entries;
}

function parseTotalBytes(contentRange) {
  const match = String(contentRange || "").match(/\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function getRemoteFileSize(url) {
  const response = await fetchWithTimeout(url, {
    headers: { Range: "bytes=0-0" },
  });

  return (
    parseTotalBytes(response.headers.get("content-range")) ||
    Number(response.headers.get("content-length")) ||
    null
  );
}

async function getTseResource(ano, resourceName) {
  const url = `${CKAN_PACKAGE_URL}?id=${encodeURIComponent(`candidatos-${ano}`)}`;
  const response = await fetchWithTimeout(url, {}, 10000);

  if (!response.ok) {
    throw new Error(`TSE CKAN error: ${response.status}`);
  }

  const data = await response.json();
  const result = data?.result;
  const resource = result?.resources?.find(
    (item) => normalizarTexto(item.name) === normalizarTexto(resourceName)
  );

  if (!resource?.url) {
    return null;
  }

  return {
    title: `Portal de Dados Abertos do TSE - ${resource.name} ${ano}`,
    url: `https://dadosabertos.tse.jus.br/dataset/candidatos-${ano}`,
    downloadUrl: resource.url,
  };
}

async function downloadTseZip(ano, resourceName) {
  const source = await getTseResource(ano, resourceName);

  if (!source) {
    return null;
  }

  const totalBytes = await getRemoteFileSize(source.downloadUrl);

  if (totalBytes && totalBytes > MAX_ZIP_BYTES) {
    throw new TSEDatasetTooLargeError({ ano, totalBytes });
  }

  const response = await fetchWithTimeout(source.downloadUrl, {}, 25000);

  if (!response.ok) {
    throw new Error(`TSE download error: ${response.status}`);
  }

  return {
    source,
    entries: extractZipEntries(Buffer.from(await response.arrayBuffer())),
  };
}

function selectCsvEntry(entries, ano, uf, prefix) {
  const desired = `${prefix}_${ano}_${String(uf || "").toUpperCase()}.csv`;
  const brasil = `${prefix}_${ano}_BRASIL.csv`;

  return (
    entries.find((entry) => entry.name.toUpperCase() === desired.toUpperCase()) ||
    entries.find((entry) => entry.name.toUpperCase() === brasil.toUpperCase()) ||
    entries.find((entry) => entry.name.toLowerCase().endsWith(".csv"))
  );
}

async function loadCandidates(ano) {
  const anoConsulta = Number(ano) || DEFAULT_TSE_YEAR;

  if (!candidateCache.has(anoConsulta)) {
    candidateCache.set(
      anoConsulta,
      (async () => {
        const zip = await downloadTseZip(anoConsulta, "Candidatos");

        if (!zip) {
          return null;
        }

        const entry = selectCsvEntry(
          zip.entries,
          anoConsulta,
          "BRASIL",
          "consulta_cand"
        );

        if (!entry) {
          return null;
        }

        return {
          source: zip.source,
          rows: parseCsv(entry.content),
        };
      })()
    );
  }

  return candidateCache.get(anoConsulta);
}

async function loadAssets(ano, uf) {
  const anoConsulta = Number(ano) || DEFAULT_TSE_YEAR;
  const ufConsulta = String(uf || "BRASIL").toUpperCase();
  const cacheKey = `${anoConsulta}:${ufConsulta}`;

  if (!assetsCache.has(cacheKey)) {
    assetsCache.set(
      cacheKey,
      (async () => {
        const zip = await downloadTseZip(anoConsulta, "Bens de candidatos");

        if (!zip) {
          return null;
        }

        const entry = selectCsvEntry(
          zip.entries,
          anoConsulta,
          ufConsulta,
          "bem_candidato"
        );

        if (!entry) {
          return null;
        }

        return {
          source: zip.source,
          rows: parseCsv(entry.content),
        };
      })()
    );
  }

  return assetsCache.get(cacheKey);
}

function scoreCandidate(candidate, search, cargo, uf) {
  const normalizedSearch = normalizarTexto(search);
  const normalizedCargo = normalizarTexto(cargo);
  const normalizedUf = String(uf || "").toUpperCase();
  const fields = [
    candidate.NM_URNA_CANDIDATO,
    candidate.NM_CANDIDATO,
    candidate.NM_SOCIAL_CANDIDATO,
  ].filter(Boolean);

  if (normalizedCargo && normalizarTexto(candidate.DS_CARGO) !== normalizedCargo) {
    return 0;
  }

  if (normalizedUf && candidate.SG_UF !== normalizedUf) {
    return 0;
  }

  let bestScore = 0;

  for (const field of fields) {
    const normalizedField = normalizarTexto(field);
    const words = normalizedSearch.split(/\s+/).filter(Boolean);
    const allWordsMatch = words.every((word) => normalizedField.includes(word));

    if (normalizedField === normalizedSearch) {
      bestScore = Math.max(bestScore, 120);
    } else if (normalizedField.startsWith(normalizedSearch)) {
      bestScore = Math.max(bestScore, 95);
    } else if (normalizedField.includes(normalizedSearch)) {
      bestScore = Math.max(bestScore, 80);
    } else if (allWordsMatch) {
      bestScore = Math.max(bestScore, 65);
    }
  }

  if (!bestScore) {
    return 0;
  }

  if (candidate.DS_SIT_TOT_TURNO === "ELEITO") {
    bestScore += 8;
  }

  if (candidate.DS_SITUACAO_CANDIDATURA === "DEFERIDO") {
    bestScore += 5;
  }

  return bestScore;
}

function parseMoney(value) {
  const normalized = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function mapCandidate(candidate, ano, source) {
  return {
    ano,
    sequencial: candidate.SQ_CANDIDATO,
    nome: candidate.NM_CANDIDATO,
    nomeUrna: candidate.NM_URNA_CANDIDATO,
    nomeSocial: candidate.NM_SOCIAL_CANDIDATO,
    cargo: candidate.DS_CARGO,
    numero: candidate.NR_CANDIDATO,
    partido: candidate.SG_PARTIDO,
    partidoNome: candidate.NM_PARTIDO,
    uf: candidate.SG_UF,
    unidadeEleitoral: candidate.NM_UE,
    eleicao: candidate.DS_ELEICAO,
    turno: candidate.NR_TURNO,
    dataEleicao: candidate.DT_ELEICAO,
    situacaoCandidatura: candidate.DS_SITUACAO_CANDIDATURA,
    resultadoTurno: candidate.DS_SIT_TOT_TURNO,
    source,
  };
}

function summarizeAssets(rows, candidateId, source) {
  const assets = rows.filter((row) => row.SQ_CANDIDATO === candidateId);
  const total = assets.reduce(
    (sum, asset) => sum + parseMoney(asset.VR_BEM_CANDIDATO),
    0
  );

  return {
    quantidade: assets.length,
    valorTotal: total,
    principais: assets
      .map((asset) => ({
        tipo: asset.DS_TIPO_BEM_CANDIDATO,
        descricao: asset.DS_BEM_CANDIDATO,
        valor: parseMoney(asset.VR_BEM_CANDIDATO),
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 3),
    source,
  };
}

async function buscarCandidatoTSE({ nome, ano, cargo, uf, incluirBens = false }) {
  const anoConsulta = Number(ano) || DEFAULT_TSE_YEAR;
  const dataset = await loadCandidates(anoConsulta);

  if (!dataset || !nome) {
    return null;
  }

  const matches = dataset.rows
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(candidate, nome, cargo, uf),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!matches.length) {
    return null;
  }

  const result = mapCandidate(matches[0].candidate, anoConsulta, dataset.source);

  if (incluirBens) {
    const assetsDataset = await loadAssets(anoConsulta, result.uf);

    if (assetsDataset) {
      result.bens = summarizeAssets(
        assetsDataset.rows,
        result.sequencial,
        assetsDataset.source
      );
    }
  }

  return result;
}

module.exports = {
  DEFAULT_TSE_YEAR,
  TSEDatasetTooLargeError,
  buscarCandidatoTSE,
};
