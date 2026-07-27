require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const fs   = require("fs");
const path = require("path");
const https= require("https");
const XLSX = require("xlsx");

const odsPath = path.join(__dirname, "..", "tmp_inspect_galicia.ods");
const agent = new https.Agent({ rejectUnauthorized: false });

function fetchBinary(url, dest) {
  return new Promise((resolve, reject) => {
    function doReq(u, hops=0) {
      if(hops>6){reject(new Error("redirects"));return;}
      const mod = u.startsWith("https")?https:require("http");
      const opts = { headers:{"User-Agent":"CarsWise/1.0"} };
      if(u.startsWith("https")) opts.agent = agent;
      mod.get(u, opts, res=>{
        if([301,302,307,308].includes(res.statusCode)){doReq(res.headers.location,hops+1);return;}
        if(res.statusCode!==200){reject(new Error(`HTTP ${res.statusCode}`));return;}
        const f=fs.createWriteStream(dest);
        res.pipe(f);
        f.on("finish",()=>{f.close();resolve();});
        f.on("error",reject);
      }).on("error",reject);
    }
    doReq(url);
  });
}

async function main() {
  const ODS_URL = "https://abertos.xunta.gal/catalogo/economia-empresa-emprego/-/dataset/0404/rexistro-talleres-reparacion-vehiculos/101/acceso-aos-datos.ods";
  console.log("Descargando ODS de Galicia...");
  await fetchBinary(ODS_URL, odsPath);
  console.log("Descargado:", fs.statSync(odsPath).size, "bytes");

  const wb = XLSX.readFile(odsPath, { type:"file" });
  console.log("Hojas:", wb.SheetNames);

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
    console.log(`\nHoja: ${sheetName}  Rango: ${sheet["!ref"]}`);

    // Mostrar primeras 5 filas como array
    const raw = XLSX.utils.sheet_to_json(sheet, { header:1, defval:"", raw:false });
    console.log("Filas 0-5:");
    raw.slice(0,6).forEach((r,i)=>console.log(`  [${i}]`, JSON.stringify(r).slice(0,200)));

    // También intentar sheet_to_json sin header
    const asObj = XLSX.utils.sheet_to_json(sheet, { defval:"", raw:false });
    if(asObj.length>0) {
      console.log("Como objeto (primer registro):", JSON.stringify(asObj[0]).slice(0,300));
    }
  }

  fs.unlinkSync(odsPath);
}
main().catch(e=>console.error(e.message));
