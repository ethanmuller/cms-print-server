import https from 'https';
import fs from 'fs';
import express from "express";
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import { printZPL } from './usb-printer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));


const app = express();
app.use(cors({
  origin: [
    'https://cmserp-sandbox.assetsbycms.com',
    'https://cmserp-prod.assetsbycms.com',
    'https://ethanmuller.com',
  ],
}));
app.use(express.json());

// -- Config: map label types to Zebra printer USB serial numbers --
// Run `node list-printers.js` to see connected printers and their serial numbers
const PRINTERS = {
  large:  "TODO_FILL_IN_SERIAL",
  narrow: "TODO_FILL_IN_SERIAL",
};

// -- ZPL templates --
// All dimensions @ 203dpi
// large:  4x6"  = 1218h x 812w dots
// narrow: 1x3"= 203w x 609h dots

function largeLabel({ lotId, destructionType }) {
  return `
^XA
^PW812
^LL1218
^FO500,50^A0R,220,220^FD${lotId}^FS
^FO440,50^BCR,80,N,N,N^FD${lotId}^FS
^FO320,50^A0R,35,35^FDDestruction Method^FS
^FO250,50^A0R,60,60^FD${destructionType}^FS
^XZ
  `.trim();
}

function largeLabelCustom({ text }) {
  return `
^XA
^PW812
^LL1218
^FO50,50^A0R,80,80^FD${new Date().toLocaleDateString()}^FS
^FO50,50^A0R,160,160^TB R,1168,730^FD${text}^FS
^XZ
  `.trim();
}

function narrowLabel({ lotId }) {
  // note: this is printing two per label, since these stickers are so long
  return `
^XA
^PW203
^LL1319
^FO0,40^A0R,90,90^FD${lotId}^FS
^FO120,40^BCR,60,N,N,N^FD${lotId}^FS
^XZ
  `.trim();
}

function narrowLabelCustom({ text }) {
  // single block, no duplication unlike the lotId version
  return `
^XA
^PW203
^LL609
^LH0,0
^FO108,127^A0R,66,66^FDFont size of^FS
^FO29,156^A0R,66,66^FDsixty-five^FS
^XZ
  `.trim();
}

// -- Routes --

app.post("/print/large", async (req, res) => {
  const { lotId, destructionType, text } = req.body;
  if (!text && (!lotId || !destructionType))
    return res.status(400).json({ error: "lotId and destructionType are required, or provide text" });

  try {
    const zpl = text
      ? largeLabelCustom({ text })
      : largeLabel({ lotId, destructionType });
    await printZPL(PRINTERS['large'], zpl);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/print/narrow", async (req, res) => {
  const { lotId, text, zpl: rawZpl } = req.body;
  if (!rawZpl && !text && !lotId) 
    return res.status(400).json({ error: "lotId is required, or provide text, or provide zpl" });

  try {
    const zpl = rawZpl ?? (text ? narrowLabelCustom({ text }) : narrowLabel({ lotId }));
    await printZPL(PRINTERS['narrow'], zpl);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


const options = {
  key: fs.readFileSync(`${__dirname}/localhost-key.pem`),
  cert: fs.readFileSync(`${__dirname}/localhost.pem`),
};

https.createServer(options, app).listen(3000, () => {
  console.log('Listening on https://localhost:3000');
});
