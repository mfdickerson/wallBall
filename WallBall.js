
var vertexShader = "vertex-shader-phong";
var fragmentShader = "fragment-shader-phong";

var timeElapsed = 0.0;

window.onload = function() {
    
    var gl = initialize();
    var g_last = Date.now();

    //var gl-canvas = document.getElementById('gl-canvas');

    /*
    * This canvas appears on to of the gl-canvas
    * It is used for printing info about the simulation (e.g. "PAUSED").
    */
    var canvas = document.getElementById('overCanvas'); // For printing messages  
    var context = overCanvas.getContext('2d')


    // World Controls
    var clearButton = document.getElementById('clearButton');
    var pauseButton = document.getElementById('pauseButton');
    var shakeButton = document.getElementById('shakeButton');

    var gravitySlider = document.getElementById('gravitySlider');
    var gravityDisplay = document.getElementById('gravityDisplay');

    var speedSlider = document.getElementById('speedSlider');
    var speedDisplay = document.getElementById('speedDisplay');

    // Ball Controls
    var addBallButton = document.getElementById('addBallButton');
    var addRandomBallButton = document.getElementById('addRandomBallButton');

    var radiusSlider = document.getElementById('radiusSlider');
    var radiusDisplay = document.getElementById('radiusDisplay');

    var massSlider = document.getElementById('massSlider');
    var massDisplay = document.getElementById('massDisplay');

    var bouncinessSlider = document.getElementById('bouncinessSlider');
    var bouncinessDisplay = document.getElementById('bouncinessDisplay');

    var colorPicker = document.getElementById('colorPicker');

    // Create the world/room/box (whatever you want to call it)
    var room = new World(gl, parseFloat(gravityDisplay.value));
    room.speed = parseFloat(speedDisplay.value);
    room.addBall(gl, 0.1, 1.0, 0.8); // Add a single ball to the room.


    var viewMatrix = lookAt(vec3(0.0,0.0,2.4), vec3(0.0,0.0,-1.0), vec3(0,1,0));
    gl.uniformMatrix4fv(gl.u_ViewMatrix, false, flatten(viewMatrix));   // set the model transform (setting to identity initially)


    /*
    * Prevents right-click menu from opening when trying to remove balls.
    */
    canvas.oncontextmenu = function(event) {
        return false;
    }

    /*
    * Gets coordinates of click, and checks to see if there are any balls to select
    */
    canvas.onmousedown = function(event) {
        //cavas coordinates
        var wx = (event.layerX)
        var wy = (canvas.height-event.layerY);
        
        // Creating eye coordinates
        var h = Math.tan(35*Math.PI/180) //35 comes from the 70 FOVY in the perspective
        var x = -h + 2*h*(wx+0.5)/canvas.width;
        var y = -h + 2*h*(wy+0.5)/canvas.height;
        
        var e = vec3(0.0,0.0,2.4); // Eye
        var d = vec3(x,y,-1.0); // Eye coordinates of click

        var closestBall;
        var closestDistance = 100; // Arbitrarily large number

        //(d*d)t^2+2d*(e-c)t+(e-c)*(e-c)-R^2=0
        for (i = 0; i< room.balls.length;i++) {
            var center = room.balls[i].position;
            var radius = room.balls[i].radius;
            var A = dot(d,d);
            var B = dot(scalev(2,d),subtract(e,center))
            var C = dot(subtract(e,center),subtract(e,center))-Math.pow(radius,2)
            
            if (Math.pow(B,2)-4*A*C >= 0) { // If the ray created from the click interesects with a ball
                var distance = dot(subtract(e,center),subtract(e,center));

                // Determines which of the ball under the mouse is closest (which one to selected)
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestBall = i;                    
                }
            }
        }

        for (i = 0; i< room.balls.length;i++) {
            if (closestBall!==i) {
                room.balls[i].isSelected=false;
            } else { //do this for the selected ball
                if (event.button == 0) { // Left-Click
                    room.balls[i].isSelected=true;

                    var center = room.balls[i].position;
                    var radius = room.balls[i].radius;

                    var t = (dot(scalev(-1,d),subtract(e,center))-Math.sqrt(Math.pow(dot(d,subtract(e,center)),2)-dot(d,d)*(dot(subtract(e,center),subtract(e,center))-Math.pow(radius,2))))/dot(d,d);
                    room.mousePosition = add(e,scalev(t,d));

                    // Prints selected ball's charateristics
                    context.font = '14pt Calibri';
                    context.textAlign="left"; 
                    context.textBaseline="bottom"; 
                    context.lineWidth = 15;
                    context.globalAlpha = 0.6;
                    context.strokeStyle = 'white';   
                    context.fillStyle = 'white';
                    //context.strokeText('PAUSED',0,canvas.height);
                    context.fillText('Mass: '+ room.balls[i].mass + ", Bounciness: "+ room.balls[i].bounciness + ", Speed: " + length(room.balls[i].velocity).toFixed(2),5,canvas.height);
                
                } else if (event.button == 2) { //Right-Click
                        var temporary = room.balls[room.balls.length-1];
                        room.balls[room.balls.length-1] = room.balls[i];
                        room.balls[i] = temporary;
                        room.balls.pop();
                }

            }
        }
            
    }

    /*
    * If a ball is selected, this moves it around the screen
    */
    canvas.onmousemove = function(event) {
        //cavas coordinates
        for (i = 0; i< room.balls.length;i++) {
            if (room.balls[i].isSelected) {

                //cavas coordinates
                var wx = (event.pageX-8)
                var wy = (canvas.height-(event.pageY-82));
                
                //eye coordinates
                var h = Math.tan(35*Math.PI/180)
                var x = -h + 2*h*(wx+0.5)/canvas.width;
                var y = -h + 2*h*(wy+0.5)/canvas.height;

                var e = vec3(0.0,0.0,2.4); //eye
                var d = vec3(x,y,-1.0);

                var planeNormal = cross(vec3(1.0,0.0,0.0),subtract(vec3(0.0,0.0,-1.0),room.mousePosition))

                
                var t = dot(planeNormal,subtract(room.mousePosition,e))/dot(planeNormal,d)
                var newMousePosition = add(e,scalev(t,d));

                var newBallVelocity = subtract(newMousePosition,room.mousePosition)
                var newBallPosition  = add(room.balls[i].position,newBallVelocity);
                //console.log(newBallPosition)

                // If the selected ball is dragged into a wall
                if (Math.abs(newBallPosition[0]) < 1.0 - room.balls[i].radius && 
                    Math.abs(newBallPosition[1]) < 1.0 - room.balls[i].radius && 
                    Math.abs(newBallPosition[2]) < 1.0 - room.balls[i].radius) {
                    
                    room.mousePosition = newMousePosition


                    room.balls[i].position = newBallPosition;
                    if (room.isPaused) {
                        room.balls[i].velocity = add(room.balls[i].velocity,scalev(1000,newBallVelocity));

                    } else {
                        room.balls[i].velocity = scalev(1/timeElapsed,newBallVelocity);
                    }
                } else {
                    if (room.isPaused) {
                        room.balls[i].velocity = add(room.balls[i].velocity,scalev(1000,newBallVelocity));
                        room.balls[i].isSelected = false;
                    } else {
                        room.balls[i].velocity = scalev(1/timeElapsed,newBallVelocity);
                        room.balls[i].isSelected = false;
                    }
                }
            }
        }




    }

    /*
    * Sets all balls to unselected and erases any info about a selected ball from the screen
    */
    canvas.onmouseup = function() {
        for (i = 0; i< room.balls.length;i++) {
            room.balls[i].isSelected=false;
            context.clearRect(0, canvas.height - 20, canvas.width, canvas.height);
        }
    }

    /*
    *Sets all balls to unselected and erases any info about a selected ball from the screen
    */
    canvas.onmouseout = function() {
        for (i = 0; i< room.balls.length;i++) {
            room.balls[i].isSelected=false;
            context.clearRect(0, canvas.height - 20, canvas.width, canvas.height);
        }
    }

    /*
    * Handles Quick-keys
    */
    window.onkeydown = function(e){
        // ADD A BALL
        console.log(e.which)

        // ADD A BALL WITH SELECTED CHARACTERISTICS
        if(e.which == 65) { //A
            room.addBall(gl, parseFloat(radiusDisplay.value), parseFloat(massDisplay.value), parseFloat(bouncinessDisplay.value));
            room.balls[room.balls.length - 1].color = vec3(hexToR(colorPicker.value)/255,hexToG(colorPicker.value)/255, hexToB(colorPicker.value)/255)
        }
        // CLEAR ROOm
        if(e.which == 67) { //C
            room.clearRoom();
        }
        // ADD A BALL WITH RANDOM VALUES;
        if (e.which == 82) {
            room.addBall(gl, 0.025+Math.random()*0.225,0.1+Math.random()*9.9,Math.random());
            room.balls[room.balls.length - 1].color = vec3(Math.random(),Math.random(), Math.random());
            //room.balls[room.balls.length - 1].color = vec3(hexToR(colorPicker.value)/255,hexToG(colorPicker.value)/255, hexToB(colorPicker.value)/255)
        }

        // SHAKES ROOM/BOX (GIVES ALL BALLS RANDOM VELOCITY)
        if (e.which == 83) { //S
            room.shake(); 
        }

        // PAUSE/UNPAUSES SIMULATION
        if(e.which == 32) { //SpaceBar
            if (room.isPaused) {
                context.clearRect(0, 0, canvas.width, canvas.height - 20);
            } else {
                context.font = '125pt Calibri';
                context.textAlign="center"; 
                context.textBaseline="middle"; 
                context.lineWidth = 15;
                context.globalAlpha = 0.4;
                context.strokeStyle = 'white';   
                context.fillStyle = 'white';
                context.strokeText('PAUSED',canvas.width/2,canvas.height/2);
                //context.fillText('PAUSED',320,320);
            }
            room.isPaused = !room.isPaused;
            return false; // Prevents page from jumping
        }

    }

    

    // World Controls
    clearButton.onclick = function(){
        room.clearRoom();
    }
    pauseButton.onclick = function(){
        if (room.isPaused) {
            context.clearRect(0, 0, canvas.width, canvas.height - 20);
        } else {
            context.font = '125pt Calibri';
            context.textAlign="center"; 
            context.textBaseline="middle"; 
            context.lineWidth = 15;
            context.globalAlpha = 0.4;
            context.strokeStyle = 'white';   
            context.fillStyle = 'white';
            context.strokeText('PAUSED',canvas.width/2,canvas.height/2);
            //context.fillText('PAUSED',320,320);
        }
        room.isPaused = !room.isPaused;
    }
    shakeButton.onclick = function(){
        room.shake();
    }
    gravitySlider.oninput = function(){
        room.gravity = parseFloat(gravitySlider.value);
        gravityDisplay.value = room.gravity;
    }
    
    gravityDisplay.onchange = function(){
        room.gravity = parseFloat(gravityDisplay.value);
        gravitySlider.value = room.gravity;
    }

    speedSlider.oninput = function(){
        room.speed = parseFloat(speedSlider.value);
        speedDisplay.value = room.speed;
    }
    
    speedDisplay.onchange = function(){
        if (parseFloat(speedDisplay.value) <= 0.0) {
            speedDisplay.value = 0.1;
        }
        room.speed = parseFloat(speedDisplay.value);
        speedSlider.value = room.speed;
    }

    addBallButton.onclick = function(){
        room.addBall(gl, parseFloat(radiusDisplay.value), parseFloat(massDisplay.value), parseFloat(bouncinessDisplay.value));
        room.balls[room.balls.length - 1].color = vec3(hexToR(colorPicker.value)/255,hexToG(colorPicker.value)/255, hexToB(colorPicker.value)/255)
    }

    addRandomBallButton.onclick = function(){
        room.addBall(gl, 0.025+Math.random()*0.225,0.1+Math.random()*9.9,Math.random());
        room.balls[room.balls.length - 1].color = vec3(Math.random(),Math.random(), Math.random())
        //room.balls[room.balls.length - 1].color = vec3(hexToR(colorPicker.value)/255,hexToG(colorPicker.value)/255, hexToB(colorPicker.value)/255)
    }

    
    bouncinessSlider.oninput = function(){
        bouncinessDisplay.value = parseFloat(bouncinessSlider.value);
    }
    
    bouncinessDisplay.onchange = function(){
        if (parseFloat(bouncinessDisplay.value) < 0.0) {
            bouncinessDisplay.value = 0.0;
        } else if (parseFloat(bouncinessDisplay.value) > 1.0){
            bouncinessDisplay.value = 1.0;
        }
        bouncinessSlider.value = parseFloat(bouncinessDisplay.value);
    }

    massSlider.oninput = function(){
        massDisplay.value = parseFloat(massSlider.value);
    }
    
    massDisplay.onchange = function(){
        if (parseFloat(massDisplay.value) < 0.1) {
            massDisplay.value = 0.1;
        }
        massSlider.value = parseFloat(massDisplay.value)
    }

    radiusSlider.oninput = function(){
        radiusDisplay.value = parseFloat(radiusSlider.value)
    }
    
    radiusDisplay.onchange = function(){
        if (parseFloat(radiusDisplay.value) < 0.025) {
            radiusDisplay.value = 0.025;
        } else if (parseFloat(radiusDisplay.value) > 0.25){
            radiusDisplay.value = 0.25;
        }
        radiusSlider.value = parseFloat(radiusDisplay.value);
    }

    /*
    *
    */
    var tick = function(){
        // update system
        var now = Date.now();
        if (room.isPaused) {
            timeElapsed = 0;
        } else {
            timeElapsed = (now - g_last)/1000; //In Seconds
            timeElapsed = timeElapsed*room.speed;
        }

        g_last = now;
    
        gl.clear(gl.COLOR_BUFFER_BIT |gl.DEPTH_BUFFER_BIT);

        room.draw();

        requestAnimationFrame(tick);
    };
        Promise.all([ initializeTexture(gl, 1, 'images/hardwood.jpg')])
      .then(function () {tick();})
      .catch(function (error) {alert('Failed to load texture '+  error.message);});
}

/*
*
*/
function initialize() {
    var canvas = document.getElementById('gl-canvas');
    
    // Use webgl-util.js to make sure we get a WebGL context
    var gl = WebGLUtils.setupWebGL(canvas);
    
    if (!gl) {
        alert("Could not create WebGL context");
        return;
    }
  
    
    // set the viewport to be sized correctly
    gl.viewport(0,0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    // create program with our shaders and enable it
    gl.program = initShaders(gl, vertexShader, fragmentShader);
    gl.useProgram(gl.program);

    
    gl.u_ModelMatrix =  gl.getUniformLocation(gl.program, 'u_ModelMatrix');
    gl.u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
    gl.u_Projection = gl.getUniformLocation(gl.program, 'u_Projection');

    gl.currentTransform = scale(1.0,1.0,1.0);
    gl.matrixStack = new Array();

    gl.uniformMatrix4fv(gl.u_ModelMatrix, false, flatten(gl.currentTransform));
    
    
    // set the perspective projection
    var projection  = perspective(70, canvas.width/canvas.height, 1, 800);
    gl.uniformMatrix4fv(gl.u_Projection, false, flatten(projection));
    
    // BEGIN LIGHTING SETUP
    var u_LightPosition= gl.getUniformLocation(gl.program, 'u_LightPosition');
    gl.uniform3f(u_LightPosition, 0.0,2.0,2.0);
    
    var u_AmbientLight = gl.getUniformLocation(gl.program, 'u_AmbientLight');
    gl.uniform3f(u_AmbientLight, 0.2, 0.2, 0.2);
    
    var u_DiffuseLight = gl.getUniformLocation(gl.program, 'u_DiffuseLight');
    gl.uniform3f(u_DiffuseLight, 0.9, 0.9, 0.9);

    var u_DiffuseLight = gl.getUniformLocation(gl.program, 'u_SpecularLight');
    gl.uniform3f(u_DiffuseLight, 0.9, 0.9, 0.9);

    var u_Shininess = gl.getUniformLocation(gl.program, 'u_Shininess');
    gl.uniform1f(u_Shininess, 3.0);
    // END LIGHTING SETUP

    //get location of attribute text_coord
    gl.a_TexCoord = gl.getAttribLocation(gl.program, "a_TexCoord");
    gl.enableVertexAttribArray(gl.a_TexCoord);
    gl.u_Sampler = gl.getUniformLocation(gl.program, 'u_Sampler');


    return gl;
}

/*
*
*/
function World(gl, gravity) {
    this.balls = [];
    this.walls = new Walls(gl);
    this.gravity = gravity;
    this.speed = 1.0;

    this.isPaused = false;
    this.mousePosition = vec3();
    
    /*
    * Adds a new ball with the given radius, mass and bounciness
    */
    this.addBall = function(gl, radius, mass, bounciness) {
        this.balls.push(new Ball(gl, radius, mass, bounciness)) //Radius, Mass, Bouncinesst
    }
    /*
    * Removes all the balls from the room
    */
    this.clearRoom = function() {
        while (this.balls.length > 0) {;
            this.balls.pop()
        } 
    }
    /*
    * Gives every ball a random velocity
    */
    this.shake = function() {
        for (i = 0; i < this.balls.length; i++) {
            this.balls[i].velocity = vec3(-5+Math.random()*10,-10+Math.random()*20,-5+Math.random()*10);
        } 
    }

    /*
    * This method is called when we want to draw the world (walls and balls)
    */
    this.draw = function() {
        this.walls.draw();

        //BEGIN COLLISION ADJUSTMENTS
        for (i = 0; i < this.balls.length; i++) {
            for (j=i+1; j < this.balls.length; j++) {

                var u = subtract(this.balls[i].position, this.balls[j].position); // Line between ball's centers

                if (length(u) <= this.balls[i].radius+this.balls[j].radius) {
                    if  (this.balls[i].alreadyCollided[j] == 0) {
                        this.balls[i].alreadyCollided[j] = 1;
                        this.balls[j].alreadyCollided[i] = 1;

                        // http://hyperphysics.phy-astr.gsu.edu/hbase/colsta.html
                        // http://physics.stackexchange.com/questions/81959/perfect-elastic-collision-and-velocity-transfer


                        u = normalize(u)

                        if (this.balls[i].isSelected) {
                            var v = scalev(dot(this.balls[i].velocity,u),u);
                            
                            this.balls[j].collisions.push(scalev(2,v))

                            u = scalev(-1,u)
                            v = scalev(dot(this.balls[j].velocity,u),u);

                            this.balls[j].collisions.push(scalev(-2,v));

                        } else if (this.balls[j].isSelected) {

 
                            var v = scalev(dot(this.balls[i].velocity,u),u);

                            this.balls[i].collisions.push(scalev(-2,v));

                            u = scalev(-1,u)

                            v = scalev(dot(this.balls[j].velocity,u),u);

                            this.balls[i].collisions.push(scalev(2,v));


                        } else {
                            var totalMass = this.balls[i].mass + this.balls[j].mass;

                            var v = scalev(dot(this.balls[i].velocity,u),u);
                    
                            this.balls[i].collisions.push(scalev(-1,v));
                            this.balls[i].collisions.push(scalev((this.balls[i].mass-this.balls[j].mass)/totalMass,v));
                            this.balls[j].collisions.push(scalev(2*this.balls[i].mass/totalMass,v))

                            u = scalev(-1,u)
                            v = scalev(dot(this.balls[j].velocity,u),u);

                            this.balls[j].collisions.push(scalev(-1,v));
                            this.balls[j].collisions.push(scalev((this.balls[j].mass-this.balls[i].mass)/totalMass,v));
                            this.balls[i].collisions.push(scalev(2*this.balls[j].mass/totalMass,v))
                        }                       
                    }
                } else {
                    this.balls[i].alreadyCollided[j] = 0;
                    this.balls[j].alreadyCollided[i] = 0;
                }
            }
        }
        // END COLLISION ADJUSTMENTS

        for (i = 0; i < this.balls.length; i++) {
            var ball = this.balls[i];
            ball.updatePosition(this.gravity);

        }   

        for (i = 0; i < this.balls.length; i++) {
            var ball = this.balls[i];
            ball.draw(); 
        } 
    }

    /*
    *
    */
    function Walls(gl) {

        var vertexBuffer;
        var normalBuffer;
        var indexBuffer;
        var texBuffer;
        //var FSIZE;
        //var numVertices;
        
       
        // vertices of the cube, we are duplicating points because the faces have different normals
        var vertices  = new Float32Array([
              1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0,-1.0, 1.0,  1.0,-1.0, 1.0, // front face
              1.0, 1.0, 1.0,  1.0,-1.0, 1.0,  1.0,-1.0,-1.0,  1.0, 1.0,-1.0, // right face
              1.0, 1.0,-1.0,  1.0,-1.0,-1.0, -1.0,-1.0,-1.0, -1.0, 1.0,-1.0, // back face
             -1.0, 1.0,-1.0, -1.0,-1.0,-1.0, -1.0,-1.0, 1.0, -1.0, 1.0, 1.0, // left face
              1.0, 1.0, 1.0,  1.0, 1.0,-1.0, -1.0, 1.0,-1.0, -1.0, 1.0, 1.0, // top face
              1.0,-1.0, 1.0, -1.0,-1.0, 1.0, -1.0,-1.0,-1.0,  1.0,-1.0,-1.0, // bottom face
        ]);
        
        
        var normals = new Float32Array([
            0.0, 0.0,-1.0,  0.0, 0.0,-1.0,  0.0, 0.0,-1.0,  0.0, 0.0,-1.0, // front face
           -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, // right face/
            0.0, 0.0, 1.0,  0.0, 0.0, 1.0,  0.0, 0.0,1.0,   0.0, 0.0, 1.0, // back face
            1.0, 0.0, 0.0,  1.0, 0.0, 0.0,  1.0, 0.0, 0.0,  1.0, 0.0, 0.0, // left face
            0.0,-1.0, 0.0,  0.0,-1.0, 0.0,  0.0,-1.0, 0.0,  0.0,-1.0, 0.0, // top face
            0.0, 1.0, 0.0,  0.0, 1.0, 0.0,  0.0, 1.0, 0.0,  0.0, 1.0, 0.0, // bottom face
        ]);

        var textureCoordinates = new Float32Array([
           1.0, 1.0,  0.0, 1.0, 0.0, 0.0, 1.0, 0.0, // front face
           1.0, 1.0,  0.0, 1.0, 0.0, 0.0, 1.0, 0.0, // right face
           1.0, 1.0,  0.0, 1.0, 0.0, 0.0, 1.0, 0.0, // back face
           1.0, 1.0,  0.0, 1.0, 0.0, 0.0, 1.0, 0.0, // left face
           1.0, 1.0,  0.0, 1.0, 0.0, 0.0, 1.0, 0.0, // top face
           1.0, 1.0,  0.0, 1.0, 0.0, 0.0, 1.0, 0.0 // bottom face
        ]);
        

        
        var indices = new Uint8Array([
           //0,1,2,  0,2,3, // front face
           4,5,6,  4,6,7,   // right face
           8,9,10, 8,10,11, // back face
           12,13,14,  12,14,15, // left face
           16,17,18, 16,18,19, // top face
           20,21,22, 20,22,23 // bottom face
        ]);
        
        
        
        
        vertexBuffer = createBuffer(gl, gl.ARRAY_BUFFER, vertices, 'vertex', gl.STATIC_DRAW);
        normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, normals, 'normal', gl.STATIC_DRAW);
        indexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, indices, 'index', gl.STATIC_DRAW);
        texBuffer = createBuffer(gl, gl.ARRAY_BUFFER, textureCoordinates, 'texture coordinate', gl.STATIC_DRAW);

        
        
        /*
        * This method is called when we want to draw the walls
        */
        this.draw = function() {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
            gl.vertexAttribPointer(gl.a_TexCoord, 2, gl.FLOAT, false,  0,0);

            gl.uniform1i(gl.u_Sampler,1);

            var u_ColorType = gl.getUniformLocation(gl.program, 'u_ColorType');
            gl.uniform1i(u_ColorType, 1);

            gl.uniformMatrix4fv(gl.u_ModelMatrix, false, flatten(gl.currentTransform));

            enableAttribute(gl, vertexBuffer, 'a_Position', 3, 0, 0);
            enableAttribute(gl, normalBuffer, 'a_Normal', 3, 0, 0);
            enableAttribute(gl, texBuffer, 'a_TexCoord', 2, 0, 0);
            
            
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_BYTE, 0);
        }
    }

    /*
     * 
     */
    function Ball(gl, radius, mass, bounciness) {

        this.radius = radius;
        this.mass = mass;
        this.bounciness = bounciness;
        this.position = vec3(-1+this.radius+Math.random()*(2-2*this.radius),-1+this.radius+Math.random()*(2-2*this.radius),-1+this.radius+Math.random()*(2-2*this.radius));
        this.velocity = vec3(-5+Math.random()*10,-5+Math.random()*10,-5+Math.random()*10);
        this.color = vec3(1,0,0);
        this.isSelected = false;

        this.collisions = [];
        this.alreadyCollided = [];

        var vertexBuffer;
        var indexBuffer;
        var normalBuffer;
        var texBuffer;
        
        var vertices = [];
        var normals = [];
        var textureCoordinates = new Float32Array([])
        var indices = [];
        var numSteps = 100;

        // call the initialization function to jumpstart this object
        setSteps(numSteps);
        
        vertexBuffer = createBuffer(gl, gl.ARRAY_BUFFER, vertices, 'vertex', gl.STATIC_DRAW);
        normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, normals, 'normal', gl.STATIC_DRAW);
        indexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, indices, 'index', gl.STATIC_DRAW);
        texBuffer = createBuffer(gl, gl.ARRAY_BUFFER, textureCoordinates, 'texture coordinate', gl.STATIC_DRAW);


        /*
        *
        */
        this.updatePosition = function (gravity) {

            /* 
            Semi-Useful collision related links
            http://gamedev.stackexchange.com/questions/15911/how-do-i-calculate-the-exit-vectors-of-colliding-projectiles
            http://www.math.usu.edu/undergraduate_program/math_refresher/online/math_1060/textbooks/larson_hostetler_edwards/chapter7/section7.4/concept3/worked_problems/problems/problem4_solution_step4.pdf
            http://www.gamasutra.com/view/feature/3015/pool_hall_lessons_fast_accurate_.php?page=3
            http://wonderfl.net/c/qZbk
            */
            if (!this.isSelected) {
                for (c = 0; c <this.collisions.length; c++) {
                    this.velocity = add(this.velocity,this.collisions.pop());

                    //this.velocity = this.collisions[c];

                }

                this.velocity[1] = gravity*timeElapsed+this.velocity[1];

                if (this.position[1] <= -1.0 + this.radius) {
                    this.velocity[0] = this.velocity[0]*0.5;
                    this.velocity[2] = this.velocity[2]*0.5;
                }

                var x = this.position[0] + this.velocity[0]*timeElapsed;
                var y = this.position[1] + this.velocity[1]*timeElapsed;
                var z = this.position[2] + this.velocity[2]*timeElapsed;
                
                
                if (Math.abs(x) > 1.0 - this.radius) {
                    this.velocity[0] = -this.velocity[0]*this.bounciness;
                } else {
                    this.position[0] = x
                }

                if (Math.abs(y) > 1.0 - this.radius) {
                    this.velocity[1] = -this.velocity[1]*this.bounciness;
                } else {
                    this.position[1] = y;
                }
                
                if (Math.abs(z) > 1.0 - this.radius) {
                    this.velocity[2] = -this.velocity[2]*this.bounciness;
                } else {
                    this.position[2] = z;
                }
                
            }
        }
        
        /*
         * This function initializes the object. It does all of the grunt work computing all of the
         * points and indices. This has been made a function to make this object mutable. We can
         * decide we want to change the number of points and recalculate the shape.
         */ 
        function setSteps(steps){
            numSteps = steps; // the number of samples per circle
            var step = 2*Math.PI/numSteps; // angular different beteen samples
         
            vertices = [];
            indices = [];
            // push north pole since it is only a single point
            vertices.push(0.0);
            vertices.push(1.0);
            vertices.push(0.0);
            
            for (var s= 1; s < numSteps; s++){
                for (var t = 0; t < numSteps; t++){
                    var tAngle = t*step;
                    var sAngle = s*step/2;
                    vertices.push(Math.cos(tAngle)*Math.sin(sAngle));
                    vertices.push(Math.cos(sAngle));
                    vertices.push(Math.sin(tAngle)*Math.sin(sAngle));
                    
                }
            }
        
            // push south pole -- again just a single point
            vertices.push(0.0);
            vertices.push(-1.0);
            vertices.push(0.0);
            
            //convert to the flat form
            vertices = new Float32Array(vertices);
            normals = new Float32Array(vertices);
            textureCoordinates = new Float32Array(vertices);

            // north pole
            // this is going to form a triangle fan with the pole and the first circle slice
            indices.push(0);
            for (var i = 1; i <= numSteps; i++){
                indices.push(i);
            }
            indices.push(1);
            
            // south pole
            // another triangle fan, we grab the last point and the last circle slice
            indices.push(vertices.length/3 - 1);
            for (var i = 1; i <= numSteps; i++){
                indices.push(vertices.length/3 - 1 - i);
            }
            indices.push(vertices.length/3 - 2);
            
            
           // the bands
           // The rest of the skin is made up of triangle strips that connect two neighboring slices
           // the outer loop controls which slice we are on and the inner loop iterates around it
            
            for (var j = 0; j < numSteps-2; j++){
                
                 for (var i = j*numSteps + 1; i <= (j+1)*numSteps; i++){
                    indices.push(i);
                    indices.push(i+numSteps);
                }
                
                // grab the first two points on the slices again to close the loop
                indices.push(j*numSteps +1);
                indices.push(j*numSteps +1 + numSteps);
                
            }
            
            
            // convert to our flat form
            indices = new Uint16Array(indices);
        }
        
        
        /*
         * This method is called when we want to draw a ball
         */
        this.draw = function() {
            // HAV TO HAVE SOMETHING
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
            gl.vertexAttribPointer(gl.a_TexCoord, 2, gl.FLOAT, false,  0,0);

            gl.uniform1i(gl.u_Sampler,1);

            // Draws with a solid color
            var u_ColorType = gl.getUniformLocation(gl.program, 'u_ColorType');
            gl.uniform1i(u_ColorType, 0)

            //Send Ball Color to Shader
            var u_BallColor = gl.getUniformLocation(gl.program, 'u_BallColor');
            if (this.isSelected) {
                gl.uniform3f(u_BallColor, 0,1,0);
            } else {
                gl.uniform3f(u_BallColor, this.color[0],this.color[1],this.color[2]);
            }
            


            gl.matrixStack.push(gl.currentTransform);   
            gl.currentTransform = mult(gl.currentTransform, translate(this.position[0], this.position[1], this.position[2])); 
            gl.currentTransform = mult(gl.currentTransform, scale(this.radius, this.radius, this.radius)); 
            gl.uniformMatrix4fv(gl.u_ModelMatrix, false, flatten(gl.currentTransform));
        
            
            enableAttribute(gl, vertexBuffer, 'a_Position', 3, 0, 0);
            enableAttribute(gl, normalBuffer, 'a_Normal', 3, 0, 0);
            enableAttribute(gl, texBuffer, 'a_TexCoord', 2, 0, 0);
            
        
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        
            // draw the shape

            var offset = 0; // keep track of how far into the index list we are
            // draw the north pole traignel fan
            //console.log(indices);
            gl.drawElements(gl.TRIANGLE_FAN, numSteps+2, gl.UNSIGNED_SHORT,0);
            offset = (numSteps+2)*indices.BYTES_PER_ELEMENT;
            
            // draw the second triangle fan for the south pole
            gl.drawElements(gl.TRIANGLE_FAN, numSteps+2, gl.UNSIGNED_SHORT,offset);
            offset+=(numSteps+2)*indices.BYTES_PER_ELEMENT;
            
            
            // loop through the bands
            for (var i = 0; i < numSteps-2; i++){
                gl.drawElements(gl.TRIANGLE_STRIP, numSteps*2 +2, gl.UNSIGNED_SHORT,offset);
                offset += (numSteps*2 + 2)* indices.BYTES_PER_ELEMENT;
            }
            gl.currentTransform = gl.matrixStack.pop();
                
        }
    
        
    }
}

/*
*
*/
function initializeTexture(gl, textureid, filename) {
    
    return new Promise(function(resolve, reject){
       var texture = gl.createTexture();

        var image = new Image();
    
    
        image.onload = function(){
            
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
            gl.activeTexture(gl.TEXTURE0 + textureid);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
            
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); //second time?

            gl.generateMipmap(gl.TEXTURE_2D);
            resolve();
        }
        
        
        image.onerror = function(error){
            reject(Error(filename));
        }
    
        image.src = filename; 
    });
}



/*
 * This is helper function to create buffers.
 */
function createBuffer(gl, destination, data, name, type){
    var buffer = gl.createBuffer();
    if (!buffer) {
        console.log('Failed to create the ',name,' buffer');
        return -1;
    }
    
    gl.bindBuffer(destination, buffer);
    gl.bufferData(destination, data, type);
    return buffer;
}


/*
 * This is a new helper function to simplify enabling attributes.
 * Note that this no longer fails if the attribute can't be found. It gives us a warning, but doesn't crash.
 * This will allow us to use different shaders with different attributes.
 */ 
function enableAttribute(gl, buffer, name, size, stride, offset){
   gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
   var attribute = gl.getAttribLocation(gl.program, name);
   if (attribute >= 0) {
       gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 0,0);
       gl.enableVertexAttribArray(attribute);
   }else{
       console.log('Warning: Failed to get ',name );

   }

}

/*
* This set of functions helps convert from hex color codes to RGB values;
*/
function hexToR(h) {return parseInt((cutHex(h)).substring(0,2),16)}
function hexToG(h) {return parseInt((cutHex(h)).substring(2,4),16)}
function hexToB(h) {return parseInt((cutHex(h)).substring(4,6),16)}
function cutHex(h) {return (h.charAt(0)=="#") ? h.substring(1,7):h}





