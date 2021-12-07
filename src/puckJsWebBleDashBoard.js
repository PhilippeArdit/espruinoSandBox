console.log(12345);
var bPreview = true;
var tempData = [];
var accXData = [];
var tabSize = 50;
for (var i = 0; i < tabSize; i++) {
   tempData.push(i);
   accXData.push(i);
}

// Caller when we get a line of data
function onLine(line) {
   try {
        var j = JSON.parse(line);
        //console.log("Received JSON: ", j);
        elements.light.setValue(j.light * 100);
        tempData.shift();
        tempData.push(j.temp);
        accXData.shift();
        accXData.push(j.ag.acc.x);
        elements.tempGraph.setData(tempData);
        elements.temp.setValue(j.temp);
        elements.accX.setValue(j.ag.acc.x);
        elements.accXGraph.setData(accXData);
        elements.bat.setValue(j.bat);
   } catch (e) {
        //console.log("Received: ", line);
   }
}

var connection;

function connectDevice() {
        if (bPreview) {
                elements.modal.remove();
                return;
        }
        Puck.connect(function (c) {
                if (!c) {
                    alert("Couldn't connect!");
                    return;
                }
                connection = c;
                // remove modal window
                elements.modal.remove();
                // Handle the data we get back, and call 'onLine'
                // whenever we get a line
                var buf = "";
                connection.on("data", function (d) {
                    buf += d;
                    var i = buf.indexOf("\n");
                    while (i >= 0) {
                        onLine(buf.substr(0, i));
                        buf = buf.substr(i + 1);
                        i = buf.indexOf("\n");
                    }
                });
                // First, reset Puck.js
                connection.write("reset();\n", function () {
                    // Wait for it to reset itself
                    setTimeout(function () {
                        // Now tell it to write data to Bluetooth
                        // 10 times a second.
                        // Also ensure that when disconnected, Puck.js
                        // resets so the setInterval doesn't keep draining battery.
                        connection.write("setInterval(\
                                                function(){\
                                                    Bluetooth.println(\
                                                        JSON.stringify(
                                                        {light:Puck.light(),bat:Puck.getBatteryPercentage(),btn:BTN.read(),ag:Puck.accel(),temp:E.getTemperature()}\
                                                        )\
                                                    );\
                                                },\
                                                500\
                                            );\
                                            NRF.on('disconnect', function() {reset()});\
                                            \n",
                            function () { console.log("Ready..."); }
                        );
                    }, 1500);
                });
        });

}

// Set up the controls we see on the screen    
var elements = {
        heading: TD.label({ x: 10, y: 10, width: 190, height: 50, label: "Sensors dashboard" }),
        light: TD.gauge({ x: 10, y: 250, width: 180, height: 180, label: "Light", value: 0, min: 0, max: 100 }),
        bat: TD.gauge({ x: 200, y: 250, width: 180, height: 180, label: "Battery Level", value: 0, min: 0, max: 100 }),
        tempGraph: TD.graph({ x: 10, y: 60, width: 350, height: 180, label: "", min: 0, max: 50, data: tempData }),
        temp: TD.value({x:10,y:60,width:100,height:10,label:"Temperature &#8451;", value: 20.55 }),
        accXGraph: TD.graph({ x: 10, y: 430, width: 350, height: 180, label: "", min: 0, max: 50, data: accXData }),
        accX: TD.value({x:10,y:60,width:100,height:10,label:"Accel X",value:1.58}),
        modal: TD.modal({ x: 10, y: 10, width: 600, height: 530, label: "Click to connect", onchange: connectDevice })
}
for (var i in elements)
        document.body.appendChild(elements[i]);