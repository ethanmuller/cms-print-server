// Direct USB (WebUSB) access to Zebra printers.
// Ported from zbp (https://github.com/ethanmuller/zbp) so zebra-print-server
// can talk to the printer directly instead of relaying through a separate process.
import pkg from 'usb';

const { WebUSB } = pkg;

const ZEBRA_VENDOR_ID = 0x0A5F;

// allowAllDevices lets us enumerate without pre-filtering
const webusb = new WebUSB({ allowAllDevices: true });

async function getZebraDevices() {
  const all = await webusb.getDevices();
  return all.filter(d => d.vendorId === ZEBRA_VENDOR_ID);
}

function deviceInfo(device) {
  return {
    serial:     device.serialNumber || null,
    name:       device.productName || `Zebra ${device.productId.toString(16).toUpperCase()}`,
    vendor_id:  device.vendorId,
    product_id: device.productId,
  };
}

// Open a WebUSB device, select config, claim the first interface with a
// bulk-out endpoint, and return { device, ifaceNumber, outEndpoint }.
async function openDevice(device) {
  await device.open();

  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }

  let ifaceNumber = null;
  let outEndpoint = null;

  outer:
  for (const iface of device.configuration.interfaces) {
    for (const alt of iface.alternates) {
      const out = alt.endpoints.find(ep => ep.direction === 'out' && ep.type === 'bulk');
      if (out) {
        ifaceNumber = iface.interfaceNumber;
        outEndpoint = out;
        await device.claimInterface(ifaceNumber);
        break outer;
      }
    }
  }

  if (outEndpoint === null) {
    await device.close();
    throw new Error('No bulk-out endpoint found on device');
  }

  return { device, ifaceNumber, outEndpoint };
}

async function closeDevice({ device, ifaceNumber }) {
  try { await device.releaseInterface(ifaceNumber); } catch (_) {}
  try { await device.close(); }                       catch (_) {}
}

export async function listZebraPrinters() {
  const devices = await getZebraDevices();
  return devices.map(deviceInfo);
}

export async function printZPL(serial, zpl) {
  const devices = await getZebraDevices();
  const target = devices.find(d => d.serialNumber === serial);

  if (!target) {
    const available = devices.map(deviceInfo).map(d => `${d.name} (${d.serial})`).join(', ');
    throw new Error(`Printer with serial "${serial}" not found. Available: ${available || 'none'}`);
  }

  let handle;
  try {
    handle = await openDevice(target);
    const buf = Buffer.from(zpl, 'utf8');
    await handle.device.transferOut(handle.outEndpoint.endpointNumber, buf);
  } finally {
    if (handle) await closeDevice(handle);
  }
}
