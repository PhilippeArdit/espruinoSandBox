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
 * Build the HTML Page
 */

function onload() {
  console.log("Loading page...");
  document.write(`
    This page presents some buttons wich interact with either 
    <a href="https://www.espruino.com/Puck.js" target="_blank">Puck.js</a>
    or
    <a href="https://www.espruino.com/Pico" target="_blank">Espruino Pico</a>
    <br /><br />

    <form>
      Device type:
      <input type="radio" name="deviceChoice" value="choice-PuckJs" id="choice-PuckJs">
      <label for="choice-PuckJs">Puck.js</label>
      <input type="radio" name="deviceChoice" value="choice-EspruinoPico" id="choice-EspruinoPico">
      <label for="choice-EspruinoPico">Espruino Pico</label>
    </form>
    <button id="btnConnect">Connect</button>
    <button id="btnDisconnect">Disconnect</button>
    <button id="btnReload">Reload</button>
    <button id="btnReset">Reset</button>
    <button id="btnSave">Save</button>

    <br /><br />
    <button id="btnI2CScanner">I2CScanner</button>
    <button id="btnOLED_HelloWorld">OLED_HelloWorld</button>
    <br /><br />

    <button id="btnShowCube">Show cube</button>

    <br /><br />

  `);

  function getRadioselectedValue(inputName) {
    const rbs = document.querySelectorAll('input[name="' + inputName + '"]');
    let selectedValue;
    for (const rb of rbs) {
      if (rb.checked) {
        selectedValue = rb.value;
        break;
      }
    }
    if (typeof selectedValue == "undefined")
      alert("Please make a choice for " + inputName);
    return selectedValue;
  }

  // When we click the connect button...
  document.querySelector('#btnConnect').onclick = function () {
    let selectedValue = getRadioselectedValue('deviceChoice');
    if (!selectedValue) return;

    let PuckOrUART = selectedValue == 'choice-PuckJs' ? Puck : selectedValue == 'choice-EspruinoPico' ? UART : {};
    connectToDevice(PuckOrUART, "(" + resetOnDisconnect.toString() + ")();\n", onLine);
  };

  // When we click the disconnect button...
  document.querySelector('#btnDisconnect').onclick = function () {
    disconnectFromDevice();
  };

  // When we click the Reload button...
  document.querySelector('#btnReload').onclick = function () {
    window.location.reload();
  };

  // When we click the Reset button...
  document.querySelector('#btnReset').onclick = function () {
    sendCodeToDevice("reset();\n");
  };

  // When we click the Save button...
  document.querySelector('#btnSave').onclick = function () {
    sendCodeToDevice("save();\n");
  };

  // When we click the I2CScanner button...
  document.querySelector('#btnI2CScanner').onclick = function () {
    let selectedValue = getRadioselectedValue('deviceChoice');
    if (!selectedValue) return;

    let serialTarget = '';
    if (selectedValue == 'choice-PuckJs')
      serialTarget = 'Bluetooth';
    else if (selectedValue == 'choice-EspruinoPico')
      serialTarget = 'USB';

    sendCodeToDevice("(" + I2CScanner.toString() + ")({i2c: I2C1, serial: " + selectedValue + "});\n");
  };

  // When we click the btnAccGyrMAgRawData button...
  document.querySelector('#btnShowCube').onclick = function () {
    var freqencyHz = 12.5; // Hz
    // Valid sample rates : 1660, 833, 416, 208, 104, 52, 26, 12.5, 1.6 Hz
    sendCodeToDevice("(" + printAccGyrMagRawData.toString() + ")(" + freqencyHz + ");\n");
    initAHRS(freqencyHz);
    createScene();
    render();
  };

  // When we click the OLED_HelloWorld button...
  document.querySelector('#btnOLED_HelloWorld').onclick = function () {
    var jsCode = jsCode = "I2C1.setup({scl:D30,sda:D31});\n";
    jsCode = jscode + OLED_HelloWorld.toString() + "\n";
    jsCode = jscode + SSD1306.toString() + "\n";
    jsCode = jscode +
      "var g = rSSD1306connect(i2c, callback, options)(I2C1, start, { address : 0x3C ,height : 48, width:64, bitrate:1000000});" +
      "\n";;
    sendCodeToDevice(jsCode);
  };

  console.log("Page loaded.");
} // onload

/**
 * Interactions with device
 */

var connection;

function disconnectFromDevice() {
  if (connection) {
    connection.close();
    connection = undefined;
  } else {
    alert("Please connect first.");
  }
}

function sendCodeToDevice(code) {
  if (connection) {
    var sentCode = 'setTimeout(function(){\n' + code.replace("'", "\'") + '\n}, 500);\n';
    console.log("Sending code:\n" + sentCode);
    connection.write(sentCode);
  } else {
    alert("Please connect first.");
    return;
  }
}

function connectToDevice(PuckOrUART, JS_CODE, callBackFunction) {
  if (connection) {
    alert("Please disconnect first.");
    return;
  }

  // Connect
  PuckOrUART.connect(function (c) {
    if (!c) {
      alert("Couldn't connect!");
      return;
    }
    connection = c;

    // Handle the data we get back, and call 'onLine' whenever we get a line
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

// When we get a line of data... 
var _acc, _gyr, _mag, _bHasRawData = false;

function onLine(line) {
  readenLine = line;
  //console.log("<- " + line);
  _bHasRawData = false;

  var d = line.split(",");
  if (d.length != 12) return;

  var i = 0;
  if (d[i++] != 'A') return;
  _acc = new THREE.Vector3(parseFloat(d[i++]) / 1000., parseFloat(d[i++]) / 1000., parseFloat(d[i++]) / 1000. - 0.8);
  if (d[i++] != 'G') return;
  _gyr = new THREE.Vector3(parseFloat(d[i++]), parseFloat(d[i++]), parseFloat(d[i++]));
  if (d[i++] != 'M') return;
  //_mag = new THREE.Vector3(parseFloat(d[i++])/1000., parseFloat(d[i++])/1000., parseFloat(d[i++])/1000.);
  _mag = new THREE.Vector3(0, 0, 0);

  _bHasRawData = true;
  //console.log(_acc);
  //console.log(_gyr);
  //console.log(_mag);
}

/**
 * ********** ********** ********** **********
 * https: //threejs.org/docs/
 * ********** ********** ********** **********
 */
var scene, camera, renderer, cube, filter, bias;

function initAHRS(freqencyHz) {
  const AHRS = require('ahrs');
  filter = new AHRS({
    /*
     * The sample interval, in Hz.
     *
     * Default: 20
     */
    sampleInterval: freqencyHz,

    /*
     * Choose from the `Madgwick` or `Mahony` filter.
     *
     * Default: 'Madgwick'
     */
    algorithm: 'Madgwick',

    /*
     * The filter noise value, smaller values have
     * smoother estimates, but have higher latency.
     * This only works for the `Madgwick` filter.
     *
     * Default: 0.4
     */
    beta: 0.4,

    /*
     * The filter noise values for the `Mahony` filter.
     */
    kp: 0.5, // Default: 0.5
    ki: 0, // Default: 0.0

    /*
     * When the AHRS algorithm runs for the first time and this value is
     * set to true, then initialisation is done.
     *
     * Default: false
     */
    doInitialisation: true,
  });

  bias = {
    nbTotVal: 50,

    gyrBias: {
      x: 0,
      y: 0,
      z: 0
    },
    nbGyrVal: 0,
    gyrBiasDone: false,
    computeGyrBias: function (rawVect) {
      if (!this.gyrBiasDone) {
        this.gyrBias.x += rawVect.x;
        this.gyrBias.y += rawVect.y;
        this.gyrBias.z += rawVect.z;
        if (++this.nbGyrVal >= this.nbTotVal) {
          this.gyrBiasDone = true;
          this.gyrBias.x /= this.nbTotVal;
          this.gyrBias.y /= this.nbTotVal;
          this.gyrBias.z /= this.nbTotVal;
        }
      }
    },

    accBias: {
      x: 0,
      y: 0,
      z: 0
    },
    nbAccVal: 0,
    accBiasDone: false,
    computeAccBias: function (rawVect) {
      if (!this.accBiasDone) {
        this.accBias.x += rawVect.x;
        this.accBias.y += rawVect.y;
        this.accBias.z += rawVect.z;
        if (++this.nbAccVal >= this.nbTotVal) {
          this.accBiasDone = true;
          this.accBias.x /= this.nbTotVal;
          this.accBias.y /= this.nbTotVal;
          this.accBias.z /= this.nbTotVal;
        }
      }
    },

    init: function () {
      this.gyrBias = {
        x: 0,
        y: 0,
        z: 0
      };
      this.nbGyrVal = 0;
      this.gyrBiasDone = false;
      this.accBias = {
        x: 0,
        y: 0,
        z: 0
      };
      this.nbAccVal = 0;
      this.accBiasDone = false;
    }
  };
  bias.init();
}

function createScene() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 10);
  camera.position.set(0, 3.5, 5);
  camera.lookAt(scene.position);

  renderer = new THREE.WebGLRenderer({
    antialias: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);

  document.body.appendChild(renderer.domElement);

  cube = new THREE.Mesh(new THREE.CubeGeometry(2, 2, 2), new THREE.MeshNormalMaterial());
  scene.add(cube);
}

const degrees_to_radians = deg => (deg * Math.PI) / 180.0;

// Render function.
var render = function () {
  requestAnimationFrame(render);

  if (!_bHasRawData) return;
  _bHasRawData = false;

  if (!bias.gyrBiasDone || !bias.accBiasDone) {
    bias.computeGyrBias(_gyr);
    bias.computeAccBias(_acc);

    if (bias.gyrBiasDone)
      console.log('bias.gyrBias :' + JSON.stringify(bias.gyrBias));
    if (bias.accBiasDone)
      console.log('bias.accBias :' + JSON.stringify(bias.accBias));
  }

  if (bias.gyrBiasDone && bias.accBiasDone) {
    /*
      Units:
        gyroscope: radians/s
        accelerometer: g, where 1 g is 9.81 m/s²
        magnetometer: unitless, but a relative proportion of the Earth's magnetic field
     */

    //filter.update(_gyr.x, _gyr.y, _gyr.z, _acc.x, _acc.y, _acc.z, _mag.x, _mag.y, _mag.z, 0.1);
    filter.update(
      degrees_to_radians(_gyr.x - bias.gyrBias.x), degrees_to_radians(_gyr.y - bias.gyrBias.y), degrees_to_radians(_gyr.z - bias.gyrBias.z),
      _acc.x - bias.accBias.x, _acc.y - bias.accBias.y, -(_acc.z - bias.accBias.z),
      _mag.x, _mag.y, _mag.z,
      1000 / filter.sampleInterval);
    var eulerAngles = filter.getEulerAngles();
    // values in radians
    // heading is from north, going west (about z - axis).
    // pitch is from vertical, going forward (about y - axis).
    // roll is from vertical, going right (about x - axis).
    cube.rotation.z = eulerAngles.heading; // yaw
    cube.rotation.x = eulerAngles.pitch;
    cube.rotation.y = eulerAngles.roll;
    /*
    cube.rotation.x += degrees_to_radians(_gyr.x);
    cube.rotation.y += degrees_to_radians(_gyr.y);
    cube.rotation.z += degrees_to_radians(_gyr.z);
     */

    //console.log(eulerAngles);
  };

  renderer.render(scene, camera);
};

/*
 * =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 * "Server" side JavaScript : code that will be uploaded to Puck.JS device thru Web BLE
 * =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 */

/**
 * Reset on disconnect
 */
function resetOnDisconnect() {
  if (typeof NRF != 'undefined') {
    NRF.on(
      'disconnect',
      function () {
        reset();
      }
    );
  }
}

/**
 * Print (acc)accelerometer, (gyr)gyroscope, (mag)magnetometer raw data
 * For more advanced usage you can also use Puck.magWr(reg,data) and Puck.magRd(reg) to configure the accelerometer chip exactly as required
 * (using the datasheet https://www.espruino.com/files/LIS3MDL.pdf)
 */
function printAccGyrMagRawData(freqencyHz) {
  Puck.accelOn(freqencyHz);
  //      Puck.accelWr(0x11, Puck.accelRd(0x11) | 0b00001100); // scale to 2000dps
  Puck.magOn();
  setInterval(
    function () {
      var d = [];

      d.push('A');
      d.push(Puck.accel().acc.x);
      d.push(Puck.accel().acc.y);
      d.push(Puck.accel().acc.z);

      d.push('G');
      d.push(Puck.accel().gyro.x);
      d.push(Puck.accel().gyro.y);
      d.push(Puck.accel().gyro.z);

      d.push('M');
      d.push(Puck.mag().x);
      d.push(Puck.mag().y);
      d.push(Puck.mag().z);
      digitalPulse(LED1, 1, 1);

      Bluetooth.println(d.join(","));
    },
    1000 / freqencyHz
  );
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
 * OLED
 */
function OLED_HelloWorld() {
  function start() {
    // write some text
    g.drawString("Hello World!", 2, 2);

    g.drawLine(0, 0, 20, 20);

    // Draw a circle
    g.drawCircle(20, 20, 10); // A circle with a radius of 50, centred at 100x100

    // Draw a filled circle
    g.fillCircle(20, 20, 10); // A filled circle with a radius of 50, centred at 100x100
    // write to the screen
    g.flip();

    var bOn = true;
    setInterval(function () {
      bOn = !bOn;
      if (bOn) g.on();
      else g.off();
    }, 500);
  }
}

/**
 * Run
 */
onload();