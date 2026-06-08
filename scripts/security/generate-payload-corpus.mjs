import { numericPayloads, routePayloads, textPayloads } from "./payloads.mjs";
import { writeReport } from "./common.mjs";

const corpus = {
  createdAt: new Date().toISOString(),
  usage:
    "Corpus local para fuzz manual/automatizado de formularios. Nao execute contra producao com dados reais.",
  textPayloads,
  numericPayloads,
  routePayloads,
};

const filePath = await writeReport("payload-corpus", corpus);
console.log(JSON.stringify({ report: filePath, payloads: textPayloads.length + numericPayloads.length + routePayloads.length }, null, 2));
