/**
 * Inspired from https://raw.githubusercontent.com/PaddeK/espruino-i2c-scanner/master/I2CScanner.js
 * 
 * Usage : 
 *  const I2CScanner = require('https://raw.githubusercontent.com/PaddeK/espruino-i2c-scanner/master/I2CScanner.js');
 *  const I2CScanner = require('https://raw.githubusercontent.com/PaddeK/espruino-i2c-scanner/master/I2CScanner.js');
 *  I2CScanner.scan({i2c: I2C1, serial: USB});
 */

const
    Progress = '|/-\\',
    Version = '0.1.0',
    Defaults = {
    i2c: null,                      // I2C Port to scan - must be set and defined as I2C Object
    serial: null,                   // Serial Port used for output - must be set and defined as Serial Object
    header: true,                   // Print header/footer of result table
    printAll: true,                 // Print every scan result (true) or only results with a found device (false)
    showProgress: true,             // Show progress indication (true) or suppress progress indication (false)
    findOne: true,                  // Stop scan if device is found (true) or scan complete address range (false)
    earlyCancel: true,              // Skip speeds after first failure (true) or always try all speeds (false)
    startAddress: 0,                // Start address of address range to scan for devices
    endAddress: 127,                // End address of address range to scan for devices
    speeds: [100, 200, 400, 800],   // Speeds in KHz to scan each address with
    noneFound: '.',                 // Symbol to use to indicate no device was found
    canceled: 'x',                  // Symbol to use to indicate canceled scan
    found: 'V'                      // Symbol to use to indicate device was found
};

scan = function (options)
{
    let prog, pad, startTime = Date.now(), count = 0, i = 0, header = '', o = Object.assign(Defaults, options || {});

    o.speeds = (Array.isArray(o.speeds) ? o.speeds : [o.speeds]).sort();

    if (!(o.serial instanceof Serial) || !(o.i2c instanceof I2C)) {
        throw new Error('Please define Options.serial and Options.i2c appropriately');
    }

    prog = () => o.serial.print(`\r${Progress[i = ++i % Progress.length]}${(new Array(header.length)).join(' ')}`);
    pad = (s, p, ps = ' ') => o.serial.print(((new Array(p + 1)).join(ps) + s).slice(-1 * p));

    header += 'TIME DEC  HEX';
    header = o.speeds.reduce((p, speed) => p + ` ${speed}`, header);
    header += ' [KHz]';

    if (o.header) {
        o.serial.println(' ');
        o.serial.println(`I2C Scanner v${Version}`);
        o.serial.println(' ');
        o.serial.println(`Legend: ${o.noneFound} = none found, ${o.canceled} = canceled, ${o.found} = found`);
        o.serial.println(' ');
        o.serial.println(header);
        pad(' ', header.length + 1, '-');
        o.serial.println(' ');
    }

    for (let address = o.startAddress; address <= o.endAddress;) {
        let found = [], fnd = false, printLine = o.printAll;

        o.speeds.some((speed, index) => {
            o.showProgress && prog();
            o.i2c.setup(Object.assign(o.i2c._options, {bitrate: speed * 1000}));

            try {
                o.i2c.writeTo(address, 0);
                found[index] = 'V';
            } catch (e) {
                found[index] = '.';
            }

            fnd |= found[index] === 'V';

            return !fnd && o.earlyCancel;
        });

        count += ~~fnd;
        printLine |= fnd;

        if (printLine) {
            o.serial.print('\r');
            pad(Math.round((Date.now() - startTime) / 1000), 4, ' ');
            pad(`${address}`, 4, ' ');
            pad(`${'0x' + ('0' + (address).toString(16)).slice(-2).toUpperCase()}`, 5, ' ');
            o.speeds.forEach((speed, index) => pad(found[index] || 'x', 4, ' '));
            o.serial.println('');
        }

        address += o.findOne && fnd ? o.endAddress : 1;
    }

    if (o.header) {
        pad(' ', header.length + 1, '-');
        o.serial.println('');
        pad(`${count} devices found in ${Math.round((Date.now() - startTime) / 1000)} seconds.`, header.length, ' ');
        o.serial.println(' ');
        o.serial.println(' ');
    }
};