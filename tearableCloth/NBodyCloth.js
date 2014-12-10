// settings

var physics_accuracy = 3,
    mouse_influence = 20,
    mouse_cut = 5,
    gravity = 1200,
    cloth_height = 30,
    cloth_width = 50,
    start_y = 20,
    spacing = 7,
    tear_distance = 60;


window.requestAnimFrame =
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function (callback) {
        window.setTimeout(callback, 1000 / 60);
    };

var canvas,
    ctx,
    cloth,
    boundsx,
    boundsy,
    mouse = {
        down: false,
        button: 1,
        x: 0,
        y: 0,
        px: 0,
        py: 0
    };

var Point = function (xIndex, yIndex) {

    this.xIndex = xIndex;
    this.yIndex = yIndex;

    this.vx = 0;
    this.vy = 0;
    this.pin_x = null;
    this.pin_y = null;

    this.constraints = [];
};

Point.prototype.initCanvasPosition = function(x, y){
    this.x = x;
    this.y = y;
    this.px = x;
    this.py = y;
};

Point.prototype.update = function ( delta) {

    if (mouse.down) {

        var diff_x = this.x - mouse.x,
            diff_y = this.y - mouse.y,
            dist = Math.sqrt(diff_x * diff_x + diff_y * diff_y);

        if (mouse.button == 1) {

            if (dist < mouse_influence) {
                this.px = this.x - (mouse.x - mouse.px) * 1.8;
                this.py = this.y - (mouse.y - mouse.py) * 1.8;
            }

        } else if (dist < mouse_cut) this.constraints = [];
    }

    this.add_force(0, gravity);

    var deltaSquared = delta * delta;

    //x(t+dt) = x(t) + v(t)dt + 1/2[a(t)(dt*dt)]
    // compute a(t+dt)
    //v(t+dt) = v(t) + 1/2[a(t+dt)+a(t)]dt

    var nx = this.x + ((this.x - this.px) * .99) + ((this.vx / 2) * deltaSquared);
    var ny = this.y + ((this.y - this.py) * .99) + ((this.vy / 2) * deltaSquared);

    this.px = this.x;
    this.py = this.y;

    this.x = nx;
    this.y = ny;

    this.vy = this.vx = 0
};

Point.prototype.draw = function () {

    if (this.constraints.length <= 0) return;

    var i = this.constraints.length;
    while (i--) this.constraints[i].draw();
};

Point.prototype.resolve_constraints = function () {

    //this.dx = 0;
    //this.dy = 0;

    if (this.pin_x != null && this.pin_y != null) {
        this.x = this.pin_x;
        this.y = this.pin_y;
        return;
    }

    var i = this.constraints.length;
    while (i--) this.constraints[i].resolve();

    var i = this.constraints.length;
    while (i--) {
        this.x += this.constraints[i].dx;
        this.y += this.constraints[i].dy;
        if(this.constraints[i].remove)
            this.constraints.splice(i, 1);
    }

    if (this.x > boundsx) {
        this.x = 2 * boundsx - this.x;
    } else if (this.x < 1) {
        this.x = 2 - this.x;
    }

    if (this.y > boundsy) {
        this.y = 2 * boundsy - this.y;
    } else if (this.y < 1) {
        this.y = 2 - this.y;
    }
};

Point.prototype.attach = function (point, direction) {

    this.constraints.push(
        new Constraint(this, point, direction)
    );
};

Point.prototype.remove_constraint = function (lnk) {
    i = this.constraints.length;
    while (i--)
        if(this.constraints[i].remove == true) this.constraints.splice(i, 1);
};

Point.prototype.add_force = function (x, y) {
    this.vx += x;
    this.vy += y;
};

Point.prototype.pin = function (pinx, piny) {
    this.pin_x = pinx;
    this.pin_y = piny;
};

var Constraint = function (p1, p2, direction) {
    this.p1 = p1;
    this.p2 = p2;
    this.direction = direction;
    this.length = spacing;
};

Constraint.prototype.resolve = function () {
    // x' : position of points before applying constraints
    //d1 = x2(t) - x1(t)
    //d2 = || d1 ||
    //d3 = (d2 - r) / d2
    //x1(t+dt) = x'(t+dt)  + 0.5(d1 * d3)
    //x2(t+dt) = x'(t+dt)  - 0.5(d1 * d3)
    if(this.direction == -1) return;
    var diff_x = this.p1.x - this.p2.x,
        diff_y = this.p1.y - this.p2.y,
        dist = Math.sqrt(diff_x * diff_x + diff_y * diff_y),
        diff = (this.length - dist) / dist;

    if (dist > tear_distance) this.remove = true;

    this.dx += this.direction * diff_x * diff * 0.5;
    this.dy += this.direction * diff_y * diff * 0.5;
};

Constraint.prototype.draw = function () {
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
};

var Cloth = function () {
    this.points = [];
    var start_x = canvas.width / 2 - cloth_width * spacing / 2;

    for (var y = 0; y <= cloth_height; y++) {
        var row = [];
        for (var x = 0; x <= cloth_width; x++) {
            var p = new Point(x, y); // Index
            p.initCanvasPosition(start_x + x * spacing, start_y + y * spacing);
            row.push(p);
        }
        this.points.push(row);
    }
    this.initializeConstraints();
};

Cloth.prototype.initializeConstraints = function(){
    for(var row=0 ; row<=cloth_height; row++) {
        for (var col = 0; col <= cloth_width; col++) {
            var p = this.points[row][col];
            p.yIndex == 0 && p.pin(p.x, p.y);

            //p.xIndex != cloth_width && p.attach(this.points[row][col + 1], -1);
            //p.yIndex != cloth_height && p.attach(this.points[row + 1][col], -1);

            if(p.xIndex != 0){
                p.attach(this.points[row][col - 1], 1);
                this.points[row][col-1].attach(p, -1);
            }

            if(p.yIndex != 0){
                p.attach(this.points[row - 1][col], 1);
                this.points[row-1][col].attach(p, -1);
            }
        }
    }
};

Cloth.prototype.update = function () {
    var times = physics_accuracy;

    while (times--) {
        for(var i=0 ; i<=cloth_height; i++)
            for(var j=0; j<=cloth_width; j++)
                this.points[i][j].resolve_constraints();
    }
    this.updateAllPoints();
};

Cloth.prototype.updateAllPoints = function(){
    for(var i=0 ; i<=cloth_height; i++)
        for(var j=0; j<=cloth_width; j++)
            this.points[i][j].update(.016);
}

Cloth.prototype.draw = function () {

    ctx.beginPath();

    for(var i=0 ; i<=cloth_height; i++)
        for(var j=0; j<=cloth_width; j++)
            this.points[i][j].draw();

    ctx.stroke();
};

function update() {

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    cloth.update();
    cloth.draw();

    requestAnimFrame(update);
}

function start() {

    canvas.onmousedown = function (e) {
        mouse.button = e.which;
        mouse.px = mouse.x;
        mouse.py = mouse.y;
        var rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left,
            mouse.y = e.clientY - rect.top,
            mouse.down = true;
        e.preventDefault();
    };

    canvas.onmouseup = function (e) {
        mouse.down = false;
        e.preventDefault();
    };

    canvas.onmousemove = function (e) {
        mouse.px = mouse.x;
        mouse.py = mouse.y;
        var rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left,
            mouse.y = e.clientY - rect.top,
            e.preventDefault();
    };

    canvas.oncontextmenu = function (e) {
        e.preventDefault();
    };

    boundsx = canvas.width - 1;
    boundsy = canvas.height - 1;

    ctx.strokeStyle = '#888';
    cloth = new Cloth();
    update();
}

window.onload = function () {

    canvas = document.getElementById('c');
    ctx = canvas.getContext('2d');

    canvas.width = 560;
    canvas.height = 350;

    start();
};