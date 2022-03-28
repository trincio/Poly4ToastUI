//NOTE 1: the call flow is typically this one enableAnchorEditing >> redrawPolygons >>  drawPolygon >> upsertAnchor >> upsertPolyhandlingButtons

//NOTE 2: english comments in the function/variables description, italian comments for the TODO and improvement notes


/*
Note sullo sviluppo: molte variabili con scope globale, nessuna classe

L'elemento essenziale è un canvas aggiuntivo, che chiamiamo SMARTCANVAS, dove operare creando dei poligoni (quadrilateri).

Il cuore del codice è in SC_kernel_ENABLE(), che può essere triggerato da un evento su un pulsante (nell'esempio).

Premendo il pulsante di completamento si fonde il canvas sul precedente



ATTENZIONE!!! è possibile esportare il contenuto di polygons o reimportarlo per poter salvare immagine originale e poligoni sovrapposti
evitando il merge e gestendolo a runtime. Questo consentirebbe di non modificare irrimediabilmente l'immagine originale. Da implementare in un secondo momento.


 */

//main button
document.querySelector('.tui-image-editor-menu').insertAdjacentHTML('beforeend', '<li id="BT_RunSmartCanvas" class="tui-image-editor-item normal" tooltip-content="smart POLYLINEFILL"   style="background:#a33;">Poly</li>');

//duplicate the canvas and setup the interface buttons
//TODO: attenzione, viene richiamata ogni volta, e se mentre alcuni elementi come lo smartcanvas può essere rimosso nella SC_interface_CLEANUP,
//      lo stile non viene rimosso e viene riaggiunto >>> Verificare se può dare problemi performance.
SC_interface_INIT = function () {

    //Injecting the style
    var style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = '[class^="anchor_quad_"]:hover { backgroundColor: #ff0; }[class^="anchor_quad_"] { backgroundColor: #00f; }';
    document.getElementsByTagName('head')[0].appendChild(style);

    document.querySelector('.tui-image-editor-menu').insertAdjacentHTML('beforeend', '<button id="SC_done">APPLICA</button>');

    //canvas
    var target = document.querySelector('.upper-canvas ');

    var cloned = target.cloneNode(true);

    cloned.classList.remove('upper-canvas');

    cloned.classList.add('smart-canvas');

    cloned.id = "smart_canvas";

    document.querySelector('.tui-image-editor-canvas-container').insertAdjacentElement('beforeend', cloned);

    //debug DOM element
    document.querySelector('.tui-image-editor-menu').insertAdjacentHTML('beforeend', '<pre id="info" style="' + smartcanvas_debug_display_style + '>INFO</pre>');
    //debug DOM element
    document.querySelector('.tui-image-editor-menu').insertAdjacentHTML('beforeend', '<pre id="smartCanvasInfo" style="overflow: auto;width:300px;height:400px;bottom: 10px; right:10px; position: fixed;"></pre>');
    //debug DOM element
    document.querySelector('.tui-image-editor-menu').insertAdjacentHTML('beforeend', '<div id="SC_status" style="' + smartcanvas_debug_display_style + 'background:#ff0; color:#000;"/>');

}

// DEBUG FUNCTIONS

//show mouse position
window.addEventListener("mousemove", function (e) {

    if (smartcanvas_debug_flag)
        document.querySelector("#info").innerText = e.offsetX + " - " + e.offsetY;

});

//log some textinfo
SCInfo = function (currenttext) {

    if (smartcanvas_debug_flag)
        document.querySelector("#smartCanvasInfo").innerText = currenttext;

}

//log (append) some textinfo
SCInfoAdd = function (currenttext) {

    if (smartcanvas_debug_flag)
        document.querySelector("#smartCanvasInfo").innerText = document.querySelector("#smartCanvasInfo").innerText + "\r\n" + currenttext;

}

//just variables for displaying debug info. Set the smartcanvas_debug_flag to true to get them for debug purposes.
var smartcanvas_debug_display_style = "display:none;";
var smartcanvas_debug_flag = false;
smartcanvas_debug = function (mytext) {

    if (smartcanvas_debug_flag)
        console.log(mytext);

}

//RELEVANT: set the smartcanvas status (EMPTY, DRAWINGPOLYGON, READYFORNEWPOLYGON, EDITING_WITH_DRAG)
setSmartcanvasStatus = function (curstatus) {
    var mysmart_canvas = document.querySelector('#smart_canvas');
    mysmart_canvas.setAttribute("current_status", curstatus);
    var SC_status = document.querySelector('#SC_status');
    SC_status.innerHTML = curstatus;
}

//RELEVANT: get the smartcanvas status
getSmartcanvasStatus = function () {

    var mysmart_canvas = document.querySelector('#smart_canvas');
    return mysmart_canvas.getAttribute("current_status");

}

//CFR: https://stackoverflow.com/questions/36308460/why-is-clientx-reset-to-0-on-last-drag-event-and-how-to-solve-it
document.addEventListener("dragover", function (event) {

    // prevent default to allow drop
    event.preventDefault();

}, false);

/* ----------- IMPORTANT: GLOBAL VARS and RELATED FUNCTIONS ------------*/

//all the data of the polygons
let polygons = Array();
//the current polygon handled (null at the beginning)
let currentlyHandledPolygon = null;

//the current polygon having anchors active (null at the beginning)
let currentAnchorEditing = null;

resetGlobalScopeVars = function () {
    currentlyHandledPolygon = null;
    currentAnchorEditing = null;
}

//add click event listener to a button that triggers the SC_kernel_ENABLE(), the main function, responsible for doing everything.
document.querySelector('#BT_RunSmartCanvas').addEventListener("click", function (e) {

    SC_kernel_ENABLE();

}, false);



/*MAIN FUNCTION SC_kernel_ENABLE()

  ___   ___     _                         _     ___  _  _    _    ___  _     ___   ____   _ 
 / __| / __|   | |__ ___  _ _  _ _   ___ | |   | __|| \| |  /_\  | _ )| |   | __| / /\ \ (_)
 \__ \| (__    | / // -_)| '_|| ' \ / -_)| |   | _| | .` | / _ \ | _ \| |__ | _| | |  | | _ 
 |___/ \___|___|_\_\\___||_|  |_||_|\___||_|___|___||_|\_|/_/ \_\|___/|____||___|| |  | |(_)
  __  __   |___| ___  _  _   ___  _   _  _ |___|___  _____  ___  ___   _  _       \_\/_/    
 |  \/  |  /_\  |_ _|| \| | | __|| | | || \| | / __||_   _||_ _|/ _ \ | \| |                
 | |\/| | / _ \  | | | .` | | _| | |_| || .` || (__   | |   | || (_) || .` |                
 |_|  |_|/_/ \_\|___||_|\_| |_|   \___/ |_|\_| \___|  |_|  |___|\___/ |_|\_|                
                                                                                          



*/


SC_kernel_ENABLE = function () {

    //initialize the interface
    SC_interface_INIT();

    //INITIAL STATUS: EMPTY
    setSmartcanvasStatus("EMPTY"); //smart canvas empty at the beginning


    //CANVAS HANDLING

	//here it creates the smart canvas, and manage it when scrolling (similar need for the icons and anchors, below, with the reOffsetPolyButtons() )
    var canvas = document.getElementById("smart_canvas");
    var injected_ctx = canvas.getContext("2d");
    var cw = canvas.width;
    var ch = canvas.height;


	//
    function smartCanvas_ReOffset() {
        var BCrect = canvas.getBoundingClientRect();
        offsetX = BCrect.left;
        offsetY = BCrect.top;
    }

    var offsetX,
    offsetY;
    smartCanvas_ReOffset();
    window.onscroll = function (e) {
        smartCanvas_ReOffset();
    }

    //todo usare una sola variabile canvas / mycanvas
    //todo: rivedere
    reOffsetPolyButtons = function () {

        for (var i = 0; i < (polygons.length); i++) {

            var BCrect = canvas.getBoundingClientRect();
            offsetX = BCrect.left;
            offsetY = BCrect.top;

            updateActualPolyCoordinates(i);

            //redrawing the polygon makes also the anchors repositioned
            drawPolygon(i, false);

        }

    }

    window.addEventListener('resize', reOffsetPolyButtons);

    //POLY COLORS AND STYLE
    injected_ctx.lineWidth = cw / 200;
    injected_ctx.strokeStyle = 'rgba(255,0,0,0.7)';
    injected_ctx.fillStyle = 'rgba(255,0,0,0.4)';

    //"coordinates" contains the CANVAS coordinates
    var coordinates = [];

    //"actual_coordinates" contains the actual MOUSE POSITION recorded coordinates
    var actual_coordinates = [];

    var isDone = false;

    var mysmart_canvas = document.querySelector("#smart_canvas");

    //THIS ENABLES THE DRAWING FUNCTIONS IN THE CANVAS
    mysmart_canvas.addEventListener("mousedown", function (e) {
        handleMouseDown(e);
    });

	//disableAnchorEditing() stops the editing using the anchors on the polygon polygonindex
    disableAnchorEditing = function (polygonindex) {

        //hide the currently active anchors
        var curAnchors = document.querySelectorAll('.anchor_quad_' + polygonindex);
        curAnchors.forEach(function (anchorelement) {
            anchorelement.style.display = "none"
        });

        //reset the global scope variable currentlyHandledPolygon
        polygonindex = null;
    }

	//enableAnchorEditing() enables the editing using the anchors on the polygon polygonindex
    enableAnchorEditing = function (polygonindex) {

        //polygonindex maybe unused. todo: decide if better using polygonindex than currentlyHandledPolygon with higher scope

        //var curAnchors = document.querySelectorAll('.anchor_quad_'+currentlyHandledPolygon);
        var curAnchors = document.querySelectorAll('.anchor_quad_' + polygonindex);

        curAnchors.forEach(function (anchorelement) {

            anchorelement.style.display = "block";
            anchorelement.setAttribute("draggable", "true");

            /*anchorelement.ondragstart = function() {
            return false;
            };*/

            anchorelement.addEventListener("drag", function (evt) {

                //in the event handler you can't use polygonindex as variable because of its global scope. Better getting it from a pre-set attribute.
                current_polygonindex = this.getAttribute("polygonindex");

                smartcanvas_debug("Triggered DRAG with position (" + evt.clientX + " - " + evt.clientY + ") for the polygon having index " + current_polygonindex);

                var curVertexIndex = this.getAttribute("vertixnumb");
                //upsertVertex(evt.clientX,evt.clientY,curVertexIndex,currentlyHandledPolygon);
                upsertVertex(evt.clientX, evt.clientY, curVertexIndex, current_polygonindex);

                //it works only when dragging
                redrawPolygons();

            }, false);

        });

    }

    function handleMouseDown(e) {

        console.log(":::::::::::    HANDLEMOUSEDOWN :::::::::::::::::");

        if (getSmartcanvasStatus() == "EDITING_WITH_DRAG") {

            smartcanvas_debug("Poligono con ANCHOR. Nessuna azione da parte di mouseDown.");

            //removes anchors and buttons for safety reasons (avoiding to click buttons while drawing, that ends in a inconsisent status and data)
            //cleanupAnchorEditingALL();
            //cleanupPolihandlingButtonsALL();
            return;
        }

        if (isDone || coordinates.length > 10) {
            return;
        }

        // tell the browser we're handling this event
        e.preventDefault();
        e.stopPropagation();

        //gmotta: if I reached the 4th angle I have a quadrangle and I'm done and the smart_canvas status is set as EMPTY


        var coordlen = -1;
        if (currentlyHandledPolygon != null)
            coordlen = polygons[currentlyHandledPolygon].coordinates.length;

        if (coordlen == 3) {
            smartcanvas_debug("Poligono completato. Reset Variabili globali e Abilitazione della modifica con gli anchor e visualizzazione dei pulsanti di azione.");

            upsertVertex(e.clientX, e.clientY, null, currentlyHandledPolygon);
            //makes anchor visible
            resetGlobalScopeVars();

            setSmartcanvasStatus("EMPTY");

            //redraws the polygons: that's the ONLY position to do it, basically.
            redrawPolygons();
            return;
        }

        // tell the browser we're handling this event
        e.preventDefault();
        e.stopPropagation();

        if (getSmartcanvasStatus() == "EMPTY") {

            console.log("Situazione iniziale. Disegno di un nuovo poligono.");
            upsertVertex(e.clientX, e.clientY, null, currentlyHandledPolygon);

            //drawPolygon(currentlyHandledPolygon);

            //LASTACTION
            //redrawPolygons();


            setSmartcanvasStatus("DRAWINGPOLIGON");
            cleanupPolihandlingButtonsALL();

        }

        //TODO ora non lo fa mai
        else if (getSmartcanvasStatus() == "READYFORNEWPOLYGON") {

            console.log("Pronto alla creazione di un nuovo poligono.");
            resetGlobalScopeVars();

            //currentlyHandledPolygon = polygons.length;
            upsertVertex(e.clientX, e.clientY, null, currentlyHandledPolygon);

            //drawPolygon(currentlyHandledPolygon);
            //redrawPolygons();
            //Changes the status: musnt' reset the globalvars (if not explicitly required)
            setSmartcanvasStatus("DRAWINGPOLIGON");

        }

        //TODO non identoco a quando empty?
        else if (getSmartcanvasStatus() == "DRAWINGPOLIGON") {

            console.log("Continua la creazione di un nuovo poligono (non resetta le variabili locali).");

            //currentlyHandledPolygon = polygons.length;
            upsertVertex(e.clientX, e.clientY, null, currentlyHandledPolygon);
            //drawPolygon(currentlyHandledPolygon);
            redrawPolygons();

        }

    }

    //redefines the actual coordinates, useful especially in case of scroll or windows resize
    updateActualPolyCoordinates = function (curPolindex) {

        //it will make easier later to work with more than 4 vertex
        var vertexnumber = polygons[curPolindex].coordinates.length;

        for (var i = 0; i < vertexnumber; i++) {
            smartcanvas_debug("changing the poly " + curPolindex + " adding to x coord " + polygons[curPolindex].coordinates[i].x + " the X offset " + offsetX);
            polygons[curPolindex].actual_coordinates[i].x = polygons[curPolindex].coordinates[i].x + offsetX;
            polygons[curPolindex].actual_coordinates[i].y = polygons[curPolindex].coordinates[i].y + offsetY;

        }

    }



	//deletePoly removes a polygon from the polygons array, then redraw them all in the canvas
    deletePoly = function (polygonindex) {

        smartcanvas_debug("check poly from DELETEPOLY  BEFORE removing(" + polygonindex + ")");
        smartcanvas_debug(JSON.stringify(polygons));

        SCInfoAdd("Deleting data of poly " + polygonindex + "\r\n and the current number of poly is " + polygons.length);
        //IMPORTANT: cleaning up BEFORE removing the polygon vertex from polygons array (everything is based on that) otherwise
        // there's the risk to get some orphaned element

        resetGlobalScopeVars();

        cleanupAnchorEditingALL();

        cleanupPolihandlingButtonsALL();

        cleanupSmartCanvas();

        polygons.splice(polygonindex, 1);

        smartcanvas_debug("check poly from DELETEPOLY  AFTER removing(" + polygonindex + ")");
        smartcanvas_debug(JSON.stringify(polygons));

        //if the poly has been deleted, but some poly remains, rewrite them
        if (polygons.length != 0)
            redrawPolygons();
        //otherwise reset the currentlyHandledPolygon to null (TODO: get rid of global scope vars)
        else
            currentlyHandledPolygon = null;

        //makes the canvas ready to proceed with a new polygon

        //TODO: MOVE TO EMPTY?
        setSmartcanvasStatus("READYFORNEWPOLYGON");

    }

    disableAnchorEditingALL = function () {

        for (var i = 0; i < polygons.length; i++)
            disableAnchorEditing(i);

    }

    cleanupAnchorEditingALL = function () {
        SCInfoAdd("cleaningup all anchors ");
        for (var i = 0; i < polygons.length; i++)
            cleanupAnchorEditing(i);

    }

    //note: the use of vertixnumb variable instead of a generic "i" is just to remind how it is composed the identifier in the dom in other parts of the program
    cleanupAnchorEditing = function (polygonindex) {

        SCInfoAdd("polygons[polygonindex].coordinates.length for poli " + polygonindex + " is " + polygons[polygonindex].coordinates.length);

        for (var vertixnumb = 0; vertixnumb < polygons[polygonindex].coordinates.length; vertixnumb++) {
            anchorDOMIdentifier = 'anchor_' + polygonindex + '_' + vertixnumb;
            var elem = document.querySelector('#' + anchorDOMIdentifier);
            if (elem)
                elem.remove();
        }

    }

    cleanupPolihandlingButtonsALL = function () {
        SCInfoAdd("cleaningup all handlingbuttons ");
        for (var i = 0; i < polygons.length; i++)
            cleanupPolihandlingButtons(i);

    }

    cleanupPolihandlingButtons = function (polygonindex) {

        PolyDOM_BTDelete = 'poly_' + polygonindex + '_DELETE';
        PolyDOM_BTSelect = 'poly_' + polygonindex + '_SELECT';
        PolyDOM_Container = 'poly_' + polygonindex + '_CONTAINER';

        SCInfoAdd("PolyDOM_Container for poli " + polygonindex + " is " + PolyDOM_Container);

        var elem = document.querySelector('#' + PolyDOM_BTDelete);
        if (elem)
            elem.remove();

        elem = document.querySelector('#' + PolyDOM_BTSelect);
        if (elem)
            elem.remove();

        elem = document.querySelector('#' + PolyDOM_Container);
        if (elem)
            elem.remove();

    }

    cleanupSmartCanvas = function () {

        injected_ctx.clearRect(0, 0, cw, ch);
    }


	
	
	//IMPORTANT: upsertVertex inserts the coordinates (relative to the canvas, proportionally set using a ratio calculated basing on the data from the ToastUI canvases) and actual coordinates 
	//   
    upsertVertex = function (vertex_posx, vertex_posy, index, polygonindex) {
        console.log(":::::::::::    upsertVertex :::::::::::::::::");

        var curPolindex = polygonindex;
        if (polygonindex == null) {

            console.log("......................upsertVertex: polygonindex is null, so it is adding a new object (namely polygon)...........");

            var polygon = new Object();
            polygon.actual_coordinates = [];
            polygon.coordinates = [];

            /*
            var polygon = new Array();
            polygon["actual_coordinates"] =[];
            polygon["coordinates"] = [];
             */

            curPolindex = polygons.length;

            polygons[curPolindex] = polygon;

            smartcanvas_debug(polygons);
            //curPolindex = polygons.push(polygon)-1;


        }

        //RAW but necessary (TODO Get rid of global scope vars)
        currentlyHandledPolygon = curPolindex;

        console.log("upsertVertex (idx " + curPolindex + " TO: " + vertex_posx + " - " + vertex_posy);

        var mysmart_canvas = document.querySelector("#smart_canvas");

        var curMaxWidth = mysmart_canvas.style.maxWidth;
        var curMaxHeight = mysmart_canvas.style.maxHeight;

        curMaxWidth = curMaxWidth.replace("px", "");
        curMaxHeight = curMaxHeight.replace("px", "");

        //il valore contenuto nello style non è quello corretto, identificato invece dagli attributi
        var curWidth = mysmart_canvas.getAttribute("width");
        var curHeight = mysmart_canvas.getAttribute("height");

        curWidth = curWidth.replace("px", "");
        curHeight = curHeight.replace("px", "");

        smartcanvas_debug("smart xy max: " + curMaxWidth + " - " + curMaxHeight + " -  " + curWidth + " - " + curHeight + " (offsets x&y: " + offsetX + "-" + offsetY + ")");

        this.xratio = curWidth / curMaxWidth;
        this.yratio = curHeight / curMaxHeight;

        Canvas_mouseX = parseInt(vertex_posx - offsetX) * this.xratio;
        Canvas_mouseY = parseInt(vertex_posy - offsetY) * this.yratio;

        //in case of a index not yet set (e.g. when drawing the poly for the first time)
        //simply it pushes the CANVAS coordinates in the array, otherwise it updates the array in the
        //index position.
        if (index == null) {
            polygons[curPolindex].coordinates.push({
                x: Canvas_mouseX,
                y: Canvas_mouseY
            });
        } else {
            //coordinates[index]={x:Canvas_mouseX,y:Canvas_mouseY};
            polygons[curPolindex].coordinates[index] = {
                x: Canvas_mouseX,
                y: Canvas_mouseY
            };
        }

        actual_mouseX = parseInt(vertex_posx);
        actual_mouseY = parseInt(vertex_posy);

        //in case of a index not yet set (e.g. when drawing the poly for the first time)
        //simply it pushes the ACTUAL coordinates in the array, otherwise it updates the array in the
        //index position.
        if (index == null) {
            actual_coordinates.push({
                x: actual_mouseX,
                y: actual_mouseY
            });
            polygons[curPolindex].actual_coordinates.push({
                x: actual_mouseX,
                y: actual_mouseY
            });

        } else {
            actual_coordinates[index] = {
                x: actual_mouseX,
                y: actual_mouseY
            };
            polygons[curPolindex].actual_coordinates[index] = {
                x: actual_mouseX,
                y: actual_mouseY
            };
        }

    }

    upsertPolyhandlingButtons = function (polygonindex) {

        if (getSmartcanvasStatus() == "DRAWINGPOLIGON") {
            //cleanupAnchorEditingALL();
            //cleanupPolihandlingButtonsALL();
            //return;
        }

        console.log(":::::::::::    UPSERTPOLYHANDLINGBUTTONS :::::::::::::::::");

        PolyDOM_BTDelete = 'poly_' + polygonindex + '_DELETE';
        PolyDOM_BTSelect = 'poly_' + polygonindex + '_SELECT';
        PolyDOM_Container = 'poly_' + polygonindex + '_CONTAINER';

        var buttonsize = "1.6";
        var fontsize = "1.2";

        var poly = polygons[polygonindex];

        var coord = poly.actual_coordinates;

        //if you haven't the 3rd node, you can't look for the middle point
        if (coord.length < 4)
            return;

        smartcanvas_debug("------------upsertPolyhandlingButtons (" + coord.length + " - " + coord[0].x + " - " + coord[2].x + ")-------------");

        //getting the actual mouse x and y for drawing correctly the anchors
        //this long set of calculation simply defines the middle vertical and horizonal position for the
        //buttons.
        var x_buttons_diagonal_1 = parseInt((Math.abs(coord[0].x - coord[2].x) / 2) + Math.min(coord[0].x, coord[2].x));
        var y_buttons_diagonal_1 = parseInt((Math.abs(coord[0].y - coord[2].y) / 2) + Math.min(coord[0].y, coord[2].y));

        var x_buttons_diagonal_2 = parseInt((Math.abs(coord[1].x - coord[3].x) / 2) + Math.min(coord[1].x, coord[3].x));
        var y_buttons_diagonal_2 = parseInt((Math.abs(coord[1].y - coord[3].y) / 2) + Math.min(coord[1].y, coord[3].y));

        var x_buttons = parseInt((x_buttons_diagonal_1 + x_buttons_diagonal_2) / 2 - 30);
        var y_buttons = parseInt((y_buttons_diagonal_2 + y_buttons_diagonal_2) / 2 - 30);

        //If the button doesn't exist, it draws it
        if (!document.getElementById(PolyDOM_BTDelete)) {

            var BTDelete = '<div id="' + PolyDOM_Container + '" style="font-size:' + fontsize + 'em; display:inline-block;  border:0px solid #000; background:rgba(0,0,255,0.4);  position:fixed; top:' + y_buttons + 'px; left:' + x_buttons + 'px;"><div id="' + PolyDOM_BTSelect + '" polygonindex=' + polygonindex + ' style="display:inline-block; width' + buttonsize + 'em; height:' + buttonsize + 'em; border:1px solid #000; color:white;">✂️</div> \
                <div id="' + PolyDOM_BTDelete + '"polygonindex=' + polygonindex + ' style="display:none; width:' + buttonsize + 'em; height:' + buttonsize + 'em; border:1px solid #000; color:white;">🗑️<div></div> \
                \
                <div id="DEBUG_' + PolyDOM_BTDelete + '"polygonindex=' + polygonindex + ' style="display:none; width:' + buttonsize + 'em; height:' + buttonsize + 'em; border:1px solid #000; color:white;">' + PolyDOM_BTDelete + '️<div></div>';

            document.querySelector('.tui-image-editor').insertAdjacentHTML('beforeend', BTDelete);

            document.querySelector('#' + PolyDOM_BTDelete).addEventListener("click", function (event) {

                //in the event handler you can't use polygonindex as variable because of its global scope. Better getting it from a pre-set attribute.
                current_polygonindex = this.getAttribute("polygonindex");

                //it deletes the current polygon
                deletePoly(current_polygonindex);

            });

            document.querySelector('#' + PolyDOM_BTSelect).addEventListener("click", function (event) {

                //in the event handler you can't use polygonindex as variable because of its global scope. Better getting it from a pre-set attribute.
                current_polygonindex = this.getAttribute("polygonindex");
                disableAnchorEditing(current_polygonindex);

                //same comment as above
                current_PolyDOM_BTDelete = 'poly_' + polygonindex + '_DELETE';

                if (currentAnchorEditing == null) {

                    //show polygon delete
                    document.querySelector('#' + current_PolyDOM_BTDelete).style.display = "inline-block";

                    enableAnchorEditing(current_polygonindex);
                    this.innerText = '🆗';
                    currentAnchorEditing = current_polygonindex;

                    setSmartcanvasStatus("EDITING_WITH_DRAG");

                } else {

                    //hide polygon delete
                    document.querySelector('#' + PolyDOM_BTDelete).style.display = "inline-block";

                    disableAnchorEditing(current_polygonindex);
                    resetGlobalScopeVars();
                    this.innerText = '✂️';
                    //makes the canvas ready to proceed with a new polygon
                    //TODO: or EMPTY simply?
                    setSmartcanvasStatus("READYFORNEWPOLYGON");
                }

            });

            //document.querySelector('#PolyDOM_BTSelect').insertAdjacentHTML('beforeend',BTDelete);

        } else { //otherwise it moves it


            document.getElementById(PolyDOM_Container).style.top = y_buttons + "px";
            document.getElementById(PolyDOM_Container).style.left = x_buttons + "px";

        }

    }

    //It adds an anchor (and updates it if existing)
    upsertAnchor = function (x, y, vertixnumb, polygonindex) {
        console.log(":::::::::::    UPSERTANCHOR :::::::::::::::::");

        var width = 8;
        var height = 8;

        //offset for centering the square
        var xoff = width / 2;
        var yoff = height / 2;

        x = parseInt(x - xoff);
        y = parseInt(y - yoff);

        anchorDOMIdentifier = 'anchor_' + polygonindex + '_' + vertixnumb;

        //If the anchor doesn't exist, it draws it
        if (!document.getElementById(anchorDOMIdentifier)) {

            smartcanvas_debug("ANCOR " + vertixnumb + " NOT EXISTS: CREATING");

            var myAnchor = '<span class="anchor_quad_' + polygonindex + '" polygonindex="' + polygonindex + '" id="' + anchorDOMIdentifier + '" vertixnumb="' + vertixnumb + '" style="display:none; width:8px; height:8px; border:1px solid #000;   position:fixed; top:' + y + 'px; left:' + x + 'px; color:white;">&nbsp;' + vertixnumb + '<span>';

            document.querySelector('.tui-image-editor').insertAdjacentHTML('beforeend', myAnchor);
        } else { //otherwise it moves it

            smartcanvas_debug("ANCOR " + vertixnumb + " EXISTS: UPDATING the anchor_" + vertixnumb + " with values " + x + " and " + y);

            document.getElementById(anchorDOMIdentifier).style.top = y + "px";
            document.getElementById(anchorDOMIdentifier).style.left = x + "px";

            //todo verificare possibile rimozione
            upsertPolyhandlingButtons(polygonindex);

        }

        smartcanvas_debug(myAnchor);

    }

    redrawPolygons = function () {

        if (polygons.length < 1) {

            SCInfoAdd("no polygon to draw.");
            return;
        }

        console.log("\ ");
        console.log(" \\");

        console.log("    > DRAWING " + polygons.length + " POLYGONS");

        console.log(" /");
        console.log("/ ");

        //during the first poligon drawing, clears up the smartcanvas
        drawPolygon(0, true);

        for (var i = 1; i < (polygons.length); i++) {

            drawPolygon(i, false)
        }

    }

    function drawPolygon(polygonindex, clearCanvasFlag) {
        console.log(":::::::::::    DRAWPOLYGON :::::::::::::::::");

        //getting the current actual coordinates and canvas coordinates


        var poly = polygons[polygonindex];

        var actual_coordinates = poly.actual_coordinates;
        var coordinates = poly.coordinates;

        //getting the actual mouse x and y for drawing correctly the anchors
        var actual_x = actual_coordinates[0].x;
        var actual_y = actual_coordinates[0].y;

        //getting the canvas (with ratio)  x and y position for drawing correctly the lines
        var cur_x = coordinates[0].x;
        var cur_y = coordinates[0].y;

        //standard activity for clearing and beginning the path

        //TODO VALUTARE SE TOGLIERE SUCCESSIVAMENTE A PRIMA CREAZIONE (altrimenti occorre ridisegnare tutti i poligoni continuamente)
        if (clearCanvasFlag)
            cleanupSmartCanvas();

        injected_ctx.beginPath();
        injected_ctx.moveTo(cur_x, cur_y);

        //adding the anchor for the first vertex
        upsertAnchor(actual_x, actual_y, 0, polygonindex);

        console.log("(anchor n.0) drawPolygon CALLING upsertAnchor (in order to add or update an anchor) with " + actual_x + " - " + actual_y);

        for (index = 1; index < coordinates.length; index++) {

            upsertAnchor(actual_coordinates[index].x, actual_coordinates[index].y, index, polygonindex);
            smartcanvas_debug("(anchor n." + index + ") drawPolygon CALLING upsertAnchor (in order to add or update an anchor) with " + actual_coordinates[index].x + " - " + actual_coordinates[index].y);

            injected_ctx.lineTo(coordinates[index].x, coordinates[index].y);
        }
        injected_ctx.closePath();
        injected_ctx.stroke();
        injected_ctx.fill();

        //draws the buttons only if not drawing the poly (means: it is EMPTY status), otherwise cleans the buttons
        if (getSmartcanvasStatus() === "EMPTY" || getSmartcanvasStatus() === "EDITING_WITH_DRAG")
            upsertPolyhandlingButtons(polygonindex);
        else
            cleanupPolihandlingButtonsALL();
    }

    SC_done_CLICK_placeholder = function () {}
    //when clicking the DONE button, it blends the smartcanvas and the lower one.local
    document.querySelector('#SC_done').addEventListener("click", function () {

        var userselection = confirm("I poligoni verranno renderizzati sull'immagine in modo definitivo. Confermi?");

        if (userselection == false) {

            return;

        } else {

            isDone = true;

            //getting the smart canvas context (origin)
            var smart_canvas = document.getElementById("smart_canvas");
            var injected_ctx = canvas.getContext("2d");

            //getting the destination canvas context
            var dest_canvas = document.querySelector(".lower-canvas");
            //var dest_canvas = document.querySelector(".upper-canvas");
            var dest_ctx = dest_canvas.getContext("2d");

            //blending of the images
            //CFR: https://www.tutorialspoint.com/Blending-two-images-with-HTML5-canvas

            var w = smart_canvas.width;
            var h = smart_canvas.height;
            var pixels = 4 * w * h;

            //getting the source imagedata
            var source_LayerImage = injected_ctx.getImageData(0, 0, w, h);
            var source_ImageData = source_LayerImage.data;
            //ctx.drawImage(myImg2, 0, 0);


            //getting the destination imagedata
            var dest_LayerImage = dest_ctx.getImageData(0, 0, w, h);
            var dest_ImageData = dest_LayerImage.data;

            for (var p = 0; p < pixels; p += 4) {

                var rs = source_ImageData[p];
                var gs = source_ImageData[p + 1];
                var bs = source_ImageData[p + 2];
                var as = source_ImageData[p + 3];

                var rd = dest_ImageData[p];
                var gd = dest_ImageData[p + 1];
                var bd = dest_ImageData[p + 2];
                var ad = dest_ImageData[p + 3];

                dest_ImageData[p] = rs * as / 255 + (1 - as / 255) * rd;
                dest_ImageData[p + 1] = gs * as / 255 + (1 - as / 255) * gd;
                dest_ImageData[p + 2] = bs * as / 255 + (1 - as / 255) * bd;
                dest_ImageData[p + 3] = 255;

            }

            dest_LayerImage.data = dest_ImageData;
            dest_ctx.putImageData(dest_LayerImage, 0, 0);

            smart_canvas.style.display = "none";

            SC_interface_CLEANUP();

            alert("Poligoni rederizzati.");
        }

    });

    //cleansup the interface elements and the additional objects
    SC_interface_CLEANUP = function () {

        cleanupAnchorEditingALL();

        cleanupPolihandlingButtonsALL();

        //remove the button done
        elem = document.querySelector("#SC_done");
        if (elem)
            elem.remove();

        //remove the smartcanvas
        elem = document.querySelector("#smart_canvas");
        if (elem)
            elem.remove();

        resetGlobalScopeVars();

        //cleanup the polygon array
        polygons.length = 0;

    }

}
