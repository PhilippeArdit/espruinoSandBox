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

    <form>
      Get Raw data for: <input type="radio" name="choiceAccGyrMAgRaw" value="acc" id="choice-acc">
      <label for="choice-acc">acc</label>
      <input type="radio" name="choiceAccGyrMAgRaw" value="gyr" id="choice-gyr">
      <label for="choice-gyr">gyr</label>
      <input type="radio" name="choiceAccGyrMAgRaw" value="mag" id="choice-mag">
      <label for="choice-mag">mag</label>
    </form>
    <button id="btnAccGyrMAgRawData">Launch</button>

    <br /><br />

  `);

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
  document.querySelector('#btnAccGyrMAgRawData').onclick = function () {
    let selectedValue = getRadioselectedValue('choiceAccGyrMAgRaw');
    if (!selectedValue) return false;
    sendCodeToDevice("(" + printAccGyrMagRawData.toString() + ")('" + selectedValue + "');\n");
    showCube();
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

// When we get a line of data... Default "onLine" function
onLine = function (line) {
  console.log("..." + line);
  var d = line.split(",");
  if (d.length == 4 && d[0] == "A") {
    // we have an accelerometer reading
    accel.x = parseInt(d[1]) / 100;
    accel.y = parseInt(d[2]) / 100;
    accel.z = parseInt(d[3]) / 100;
    console.log(accel.x + " " + accel.y + " " + accel.z + " ");
    renderScene();
  }
}

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
        connection.write("\x03\x10\x03\x10if(1){" + JS_CODE + "}\n",
          function () {
            console.log("Ready...");
          });
      }, 1500);
    });
  });
}

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

/**
 * https: //threejs.org/docs/
 */
var scene, camera, renderer, cube, WIDTH, HEIGHT, accel;

function showCube() {

  WIDTH = window.innerWidth;
  HEIGHT = window.innerHeight;
  accel = new THREE.Vector3(0, 0, 1);

  createScene();
  renderScene();
}

function createScene() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(70, WIDTH / HEIGHT, 1, 10);
  camera.position.set(0, 3.5, 5);
  camera.lookAt(scene.position);

  renderer = new THREE.WebGLRenderer({
    antialias: true
  });
  renderer.setSize(WIDTH, HEIGHT);

  document.body.appendChild(renderer.domElement);

  cube = new THREE.Mesh(new THREE.CubeGeometry(2, 2, 2), new THREE.MeshNormalMaterial());
  scene.add(cube);

  console.log(accel.x + ", " + accel.y + ", " + accel.z);
}

function renderScene() {
  cube.lookAt(accel);
  renderer.render(scene, camera);
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