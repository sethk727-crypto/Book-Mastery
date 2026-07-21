// The subpath import skips pdf-parse's index.js debug harness, which tries
// to read a local test PDF when it thinks it is the entry module.
declare module "pdf-parse/lib/pdf-parse.js" {
  import pdfParse from "pdf-parse";
  export default pdfParse;
}
