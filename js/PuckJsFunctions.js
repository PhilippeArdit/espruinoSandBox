/**
 * Tests inspired from :
 * - https://www.espruino.com/Puck.js
 * - https://github.com/espruino/EspruinoDocs/blob/master/boards/Puck.js.md 
 */

/*
 * =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 * Client side JavaScript
 * =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 */

/**
 * Connect to Puck.js
 */
var connection;

function disconnectFromPuckJs() {
  // disconnect if connected already
  if (connection) {
    connection.close();
    connection = undefined;
  }
}

function sendToPuckJs(code) {
  if (connection) {
    connection.write(code);
  }
}

function connectToPuckJs(JS_CODE, callBackFunction) {
  // disconnect if connected already
  disconnectFromPuckJs();
  // Connect
  Puck.connect(function (c) {
    if (!c) {
      alert("Couldn't connect!");
      return;
    }
    connection = c;
    // Handle the data we get back, and call 'onLine'
    // whenever we get a line
    var buf = "";
    connection.on("data", function (d) {
      buf += d;
      var l = buf.split("\n");
      buf = l.pop();
      l.forEach(callBackFunction);
    });
    // First, reset the Bangle
    connection.write("reset();\n", function () {
      // Wait for it to reset itself
      setTimeout(function () {
        // Now upload our code to it
        connection.write("\x03\x10if(1){" + JS_CODE + "}\n",
          function () {
            console.log("Ready...");
          });
      }, 1500);
    });
  });
}


/*
 * =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 * "Server" side JavaScript : code that will be uploaded to Puck.JS device thru Web BLE
 * =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 */

/**
 * Reset on disconnect
 */
function resetOnDisconnect() {
  NRF.on(
    'disconnect',
    function () {
      reset();
    }
  );
}

/**
 * Print (acc)accelerometer, (gyr)gyroscope, (mag)magnetometer raw data
 * For more advanced usage you can also use Puck.magWr(reg,data) and Puck.magRd(reg) to configure the accelerometer chip exactly as required
 * (using the datasheet https://www.espruino.com/files/LIS3MDL.pdf)
 */
function printAccGyrMagRawData(what) {
  var bOk = true;
  switch (what) {
    case 'acc':
      Puck.accelOn(26); // 26Hz
      Puck.accelWr(0x11, Puck.accelRd(0x11) | 0b00001100); // scale to 2000dps
      break;
    case 'gyr':
      Puck.accelOn(26); // 26Hz
      Puck.accelWr(0x11, Puck.accelRd(0x11) | 0b00001100); // scale to 2000dps
      break;
    case 'mag':
      Puck.magOn();
      break;
    default:
      bOk = false;
  }
  if (bOk) {
    setInterval(
      function () {
        var d = [];
        switch (what) {
          case 'acc':
            d.push('A');
            d.push(Puck.accel().acc.x);
            d.push(Puck.accel().acc.y);
            d.push(Puck.accel().acc.z);
            digitalPulse(LED1, 1, 1);

            break;
          case 'gyr':
            d.push('G');
            d.push(Puck.accel().gyro.x);
            d.push(Puck.accel().gyro.y);
            d.push(Puck.accel().gyro.z);
            digitalPulse(LED2, 1, 1);

            break;
          case 'mag':
            d.push('M');
            d.push(Puck.mag().x);
            d.push(Puck.mag().y);
            d.push(Puck.mag().z);
            digitalPulse(LED3, 1, 1);
            break;
          default:
            d.push(what);
        }
        Bluetooth.println(d.join(","));
      },
      125
    );
  }
}

/**
 * Movement detection
 */
function movementDetection() {
  require("puckjsv2-accel-movement").on();
  var idleTimeout;
  Puck.on('accel', function (a) {
    LED.set();
    if (idleTimeout) clearTimeout(idleTimeout);
    else print("Motion", a);
    idleTimeout = setTimeout(function () {
      idleTimeout = undefined;
      LED.reset();
    }, 500);
  });
  // require("puckjsv2-accel-movement").off();
}

/**
 * Rotation counter
 */
function rotationCounter() {
  Puck.accelOn();
  Puck.accelWr(0x11, 0b00011100); // scale to 2000dps
  var d = 0;
  Puck.on("accel", a => d += a.gyro.z / 64000);
  setInterval(function () {
    print(d.toFixed(2));
  }, 500);
}


/**
 * From https://github.com/espruino/EspruinoApps/tree/master/apps/puckrotate
 * and https://espruino.github.io/EspruinoApps
 */
function rotationAdvertising() {
  var d = 0,
    lastAccel;
  var timeStationary = 0;
  var advCounter = 0;

  function setAdvertising(r) {
    /** NRF.setAdvertising({},{
      showName:false,
      manufacturer:0x0590,
      manufacturerData:JSON.stringify({r:Math.round(d*100)/100})
    });
    */
    print({
      r: Math.round(d * 100) / 100
    });
  }

  function onAccel(r) {
    lastAccel = r;
    d -= r.gyro.z / 768000;
    var a = r.acc;
    a.mag = a.x * a.x + a.y * a.y + a.z * a.z;
    a.ang = Math.atan2(a.y, a.x) / (2 * Math.PI);
    if (a.mag < 66000000 || a.mag > 71000000) {
      timeStationary = 0;
    } else {
      if (timeStationary < 200) timeStationary++;
      else { // no activity, sleep
        Puck.accelOff();
        sleep();
      }
      if (timeStationary > 50) {
        // if stable for a while, re-align turn count
        var nearest = Math.round(d) + a.ang;
        d = d * 0.8 + nearest * 0.2;
      }
    }
    advCounter++;
    if (advCounter > 26) { // once a second
      advCounter = 0;
      setAdvertising(r);
    }
  }

  function wake() {
    digitalPulse(LED1, 1, 10); // indicate awake red
    timeStationary = 0;
    advCounter = 0;
    Puck.removeAllListeners('accel');
    Puck.on("accel", onAccel);
    Puck.accelOn(26); // 26Hz
    Puck.accelWr(0x11, Puck.accelRd(0x11) | 0b00001100); // scale to 2000dps
  }

  function sleep() {
    digitalPulse(LED2, 1, 10); // indicate sleeping green
    var last = getTime() + 2;
    Puck.removeAllListeners('accel');
    Puck.on('accel', function (a) {
      if (getTime() < last) return; // ignore events while accelerometer settles
      require("puckjsv2-accel-movement").off();
      wake();
    });
    require("puckjsv2-accel-movement").on();
  }

  wake();
  setAdvertising();
}

/**
 * Calibration TODO
 */
function calibrateAcc() {
  Puck.accelOn();

  setInterval(
    function () {
      var d = [

        Math.round(Puck.accel().acc.x),
        Math.round(Puck.accel().acc.y),
        Math.round(Puck.accel().acc.z)

      ];
      Bluetooth.println(d.join(" "));
    },
    100
  );
}