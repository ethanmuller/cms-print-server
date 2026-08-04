// list-printers.js
import { listZebraPrinters } from './usb-printer.js';

const printers = await listZebraPrinters();
console.log("Connected Zebra printers:");
if (printers.length === 0) console.log("  (none found)");
printers.forEach(p => console.log(
  ` - ${p.name}  serial=${p.serial}  vendor=0x${p.vendor_id.toString(16)}  product=0x${p.product_id.toString(16)}`
));
