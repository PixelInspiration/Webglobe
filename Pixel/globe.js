var DAT = DAT || {};
var initZoom, initCard;


DAT.Globe = function(container, opts) {
  opts = opts || {};
  
  var colorFn = opts.colorFn || function(x) {
    var c = new THREE.Color();
    c.setHSL( ( 0.6 - ( x * 0.5 ) ), 1.0, 0.5 );
    return c;
  };
  var imgDir = opts.imgDir || '/globe/';

  var Shaders = {
    'earth' : {
      uniforms: {
        'texture': { type: 't', value: null }
      },
      vertexShader: [
        'varying vec3 vNormal;',
        'varying vec2 vUv;',
        'void main() {',
          'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
          'vNormal = normalize( normalMatrix * normal );',
          'vUv = uv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D texture;',
        'varying vec3 vNormal;',
        'varying vec2 vUv;',
        'void main() {',
          'vec3 diffuse = texture2D( texture, vUv ).xyz;',
          'float intensity = 1.05 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) );',
          'vec3 atmosphere = vec3( 1.0, 1.0, 1.0 ) * pow( intensity, 3.0 );',
          'gl_FragColor = vec4( diffuse + atmosphere, 1.0 );',
        '}'
      ].join('\n')
    },
    'atmosphere' : {
      uniforms: {},
      vertexShader: [
        'varying vec3 vNormal;',
        'void main() {',
          'vNormal = normalize( normalMatrix * normal );',
          'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vNormal;',
        'void main() {',
          'float intensity = pow( 0.8 - dot( vNormal, vec3( 0, 0, 1.0 ) ), 12.0 );',
          'gl_FragColor = vec4( 1.0, 1.0, 1.0, 1.0 ) * intensity;',
        '}'
      ].join('\n')
    }
  };

  var camera, scene, renderer, w, h;
  var sphere, atmosphere, point, projector;
  var globeManipulator;

  var overRenderer;

  var curZoomSpeed = 0;
  var zoomSpeed = 50;

   var pointMesh = [],
    stopaMesh = [],
    dotMesh = [], 
  	dotData = [],  	
  	cities = [],
  	activeCity = -1;
  
  var mouse = { x: 0, y: 0 }, mouseOnDown = { x: 0, y: 0 };
  
  var mouseOnDown = { x: 0, y: 0 };
  var mouseDownOn = false;
  
  var rotation = { x: 0, y: 0 },
      target = { x: Math.PI*3/2, y: Math.PI / 6.0 },
      targetOnDown = { x: 0, y: 0 };

  var distance = 100000, distanceTarget = 100000;
  var padding = 40;
  var PI_HALF = Math.PI / 2;

  function init() {
  
    container.style.color = '#fff';
    container.style.font = '13px/20px Arial, sans-serif';

    var shader, uniforms, material;
    w = container.offsetWidth || window.innerWidth;
    h = container.offsetHeight || window.innerHeight;

    camera = new THREE.PerspectiveCamera(30, w / h, 1, 10000);
    camera.position.z = distance;

    scene = new THREE.Scene();

    var geometry = new THREE.SphereGeometry(200, 40, 30);

    shader = Shaders['earth'];
    uniforms = THREE.UniformsUtils.clone(shader.uniforms);

    uniforms['texture'].value = THREE.ImageUtils.loadTexture(imgDir+'world.jpg');

    material = new THREE.ShaderMaterial({

          uniforms: uniforms,
          vertexShader: shader.vertexShader,
          fragmentShader: shader.fragmentShader

        });

    sphere = new THREE.Mesh(geometry, material);
    sphere.rotation.y = Math.PI;
    
	scene.add(sphere);
	

    shader = Shaders['atmosphere'];
    uniforms = THREE.UniformsUtils.clone(shader.uniforms);

    material = new THREE.ShaderMaterial({

          uniforms: uniforms,
          vertexShader: shader.vertexShader,
          fragmentShader: shader.fragmentShader,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          transparent: true

        });

    atmosphereMesh = new THREE.Mesh(geometry, material);
    atmosphereMesh.scale.set( 1.1, 1.1, 1.1 );
    scene.add(atmosphereMesh);
	

    geometry = new THREE.BoxGeometry(0.75, 0.75, 1);
    geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0,0,-0.5));

    point = new THREE.Mesh(geometry);

    projector = new THREE.Projector();

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(w, h);

    renderer.domElement.style.position = 'absolute';

    container.appendChild(renderer.domElement);

    container.addEventListener('mousedown', function(e){
      mouseDownOn = true;
      onMouseDown(e);
    }, false);

    container.addEventListener('touchstart', function(e){
    	mouseDownOn = true;
    	overRenderer = true;
    	onTouchStart(e);
    }, false);

    container.addEventListener('touchend', function(e){
    //	overRenderer = false;
      mouseDownOn = (e.touches.length == 0 ? false: true );
    	onTouchEnd(e);
    }, false);

    // globeManipulator = new globe_manipulator({
    //     dom_object: renderer.domElement,
    //     camera: camera,
    //     radius: 100.0,
    //     auto_rotate: false,
    //     on_clicked_callback: null,
    //     right_click_to_select: true,
    //     start_lat: 37.520925,
    //     start_lng: -122.309460,
    //     start_distance: 300,
    //     min_distance: 120.0,
    //     max_distance: 450.0,
    //     mesh: sphere
    // });


    container.addEventListener('mousewheel', onMouseWheel, false);

    document.addEventListener('keydown', onDocumentKeyDown, false);

    window.addEventListener('resize', onWindowResize, false);

    container.addEventListener('mouseover', function() {
      overRenderer = true;
    }, false);

    container.addEventListener('mouseout', function() {
      overRenderer = false;
    }, false);
  }

   

  
  
  
  function addData(data, opts) {
		var lat, lng, size, color, img, i, colorFnWrapper, slideshowURL, title,  price, description;
		
		opts.animated = opts.animated || false;
		this.is_animated = opts.animated;
		step = 4;
		colorFnWrapper = function(data, i) { return colorFn(2); }

		var subgeo = new THREE.Geometry();
		
		for (i = 0; i < data.length ; i++) {
			
			 lat = data[i][0];
			 lng = data[i][1];
       title = data[i][2]; 
       price = data[i][3];
       description = data[i][4];
			 size = 50;
			 step = 4;
			 color = colorFnWrapper(data[i], 0);
			 addCity(lat, lng, size, color, subgeo, title,  price, description);
			 
			pointMesh.push(point);
			stopaMesh.push(stopa);

			//meshes holding both line and bottom circle (stopa) for animating lines
			dotMesh.push(point, stopa);
			dotData.push(point.scale.z, stopa.scale.z);

			
			scene.add(point);
			scene.add(stopa);
			
		}

		this._baseGeometry = subgeo;
  };

  function createPoints() {
    if (this._baseGeometry !== undefined) {
      if (this.is_animated === false) {
        this.points = new THREE.Mesh(this._baseGeometry, new THREE.MeshBasicMaterial({
              color: 0xffffff,
              vertexColors: THREE.FaceColors,
              morphTargets: false
            }));
      } else {
        if (this._baseGeometry.morphTargets.length < 8) {
          console.log('t l',this._baseGeometry.morphTargets.length);
          var padding = 8-this._baseGeometry.morphTargets.length;
          console.log('padding', padding);
          for(var i=0; i<=padding; i++) {
            console.log('padding',i);
            this._baseGeometry.morphTargets.push({'name': 'morphPadding'+i, vertices: this._baseGeometry.vertices});
          }
        }
        this.points = new THREE.Mesh(this._baseGeometry, new THREE.MeshBasicMaterial({
              color: 0xffffff,
              vertexColors: THREE.FaceColors,
              morphTargets: true
            }));
      }
      // scene.add(this.points);
	  // scene.add(stopa);
	  
    }
  }

  function addCity(lat, lng, size, color, subgeo, title,  price, description) {

   var material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: THREE.FaceColors
    });
  
    var phi = (90 - lat) * Math.PI / 180;
    var theta = (180 - lng) * Math.PI / 180;

	point3d = new THREE.BoxGeometry(1.5, 1.5, 0.3);
  	point = new THREE.Mesh(point3d, material);
	
    point.position.x = 200 * Math.sin(phi) * Math.cos(theta);
    point.position.y = 200 * Math.cos(phi);
    point.position.z = 200 * Math.sin(phi) * Math.sin(theta);

    point.lookAt(sphere.position);

    point.scale.z = Math.max( size, 0.1 ); // avoid non-invertible matrix
    // point.updateMatrix();

    for (var i = 0; i < point.geometry.faces.length; i++) {

      point.geometry.faces[i].color = color;

    }
    if(point.matrixAutoUpdate){
      point.updateMatrix();
    }
    subgeo.merge(point.geometry, point.matrix);
	
	
	//Stopa
    var stopalo = new THREE.CylinderGeometry(2, 2, 0, 14, 0, false);
    stopa = new THREE.Mesh(stopalo, material);

    stopa.position.x = 200 * Math.sin(phi) * Math.cos(theta);
    stopa.position.y = 200 * Math.cos(phi);
    stopa.position.z = 200 * Math.sin(phi) * Math.sin(theta);    
    
    //rotate the cylinder
    stopalo.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  
    stopa.lookAt(sphere.position);
    

    for (i = 0; i < stopa.geometry.faces.length; i++) {
      stopa.geometry.faces[i].color = color;
    }

    cities.push({'position': point.position.clone(), 'img': null, 'color' : color, 'size' : size, 'lat' : lat, 'lng' : lng, 'title' : title, 'desc' : description, 'price':price, 'link': 'http://www.flightcentre.co.uk'});
     
	// scene.add(stopa);
	// scene.add(this.point);
  }


  function objectPick(event) {
  	
      var vector = new THREE.Vector3((event.clientX / window.innerWidth) * 2 - 1, - (event.clientY / window.innerHeight) * 2 + 1, 0.5);

      //var vector = new THREE.Vector3((mouseOnDown.x / window.innerWidth) * 2 - 1, - (mouseOnDown.y / window.innerHeight) * 2 + 1, 0.5);
  
     projector.unprojectVector(vector, camera);
      var raycaster = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());

      var intersects = raycaster.intersectObject(sphere);
      console.log(intersects);
      if (intersects.length > 0) {
        return intersects[0].point;
      }

      return null;
    }


  function findClosestCity(point) {
      point.sub(sphere.position).normalize();

      var city;
      var index = -1, best, dist;

      for (var i = 0; i < cities.length; i++) {
        city = cities[i].position.clone();
        city.sub(sphere.position).normalize();
        dist = city.dot(point);
  			
        if (index === -1 || dist > best) {
          index = i;
          best = dist;
  				
        }
      }

      if (index === -1 || best < 0.9998) {
        return -1;
      }
  		
      return index;
    }



  // - Touch events

  var lastTouchedEvent = null;

  function onTouchStart(event) {
    event.preventDefault();

    container.addEventListener('touchmove', onTouchMove, false);
    container.addEventListener('touchstart', onTouchStart, false);
    container.addEventListener('touchend', onTouchEnd, false);
    
    if( event.touches.length == 1 ){
      //reset target to match current rotation
      target.x = rotation.x;  
      target.y = rotation.y;
    }


    mouseOnDown.x = - event.touches[0].clientX;
    mouseOnDown.y = event.touches[0].clientY;
    lastTouchedEvent = event;
    targetOnDown.x = target.x;
    targetOnDown.y = target.y;


    if(event.touches.length == 2){
      originalDistanceTarget = distanceTarget;
      originalSep = distanceBetweenEventPoints(event.touches[0],event.touches[1]);
    }

    container.style.cursor = 'move';
  }

  function onTouchEnd(event) {
    container.removeEventListener('touchmove', onTouchMove, false);
    container.removeEventListener('touchstart', onTouchStart, false);
    container.removeEventListener('touchend', onTouchEnd, false);
    container.style.cursor = 'auto';

    checkCityNearby(lastTouchedEvent.touches[0]);
    
  }

  function setActiveCity(newCity) {
      activeCity = newCity;
      if (newCity !== -1) {
        var tween = new TWEEN.Tween( {scalePoint: 1, scaleText: 0} )
          .to({scalePoint: 2, scaleText: 1}, 200)
          .easing(TWEEN.Easing.Cubic.EaseIn)
          .onUpdate( function() {
            pointMesh[newCity].scale.x = this.scalePoint;
            pointMesh[newCity].scale.y = this.scalePoint;
            pointMesh[newCity].updateMatrix();
          })
          .start();
    
        
      }
    }



  var originalDistanceTarget = null;
  var originalSep = null;
  var previousDistance = 0;

  function distanceBetweenEventPoints( pnt1, pnt2 ){
      var x1 = pnt1.clientX;
      var x2 = pnt2.clientX;
      var y1 = pnt1.clientY;
      var y2 = pnt2.clientY;
      return Math.sqrt(Math.pow((x2 - x1), 2.0) + Math.pow((y2 - y1), 2.0));
  }

  function onTouchMove(event) {
  	 //multitouch
    if(event.touches.length > 1){
      
      var sep = distanceBetweenEventPoints(event.touches[0],event.touches[1]);
     
      //check if pinch out or pinch in
      //zooming out
      var ratio = sep / originalSep;
      console.log( ratio );
      
      setDistanceTarget( originalDistanceTarget * 1 / ratio );

      mouse.x = - 0.5 * (event.touches[0].clientX + event.touches[1].clientX);
      mouse.y = 0.5 * ( event.touches[0].clientY + event.touches[1].clientY );

    }else{
      mouse.x = - event.touches[0].clientX;
      mouse.y = event.touches[0].clientY;
    }
    
    var zoomDamp = distance/1000;

    target.x = targetOnDown.x + (mouse.x - mouseOnDown.x) * 0.005 * zoomDamp;
    target.y = targetOnDown.y + (mouse.y - mouseOnDown.y) * 0.005 * zoomDamp;

    /*
    target.y = target.y > PI_HALF ? PI_HALF : target.y;
    target.y = target.y < - PI_HALF ? - PI_HALF : target.y;
    */

    target.y = Math.max( -PI_HALF, Math.min( PI_HALF, target.y ) );
  }

  //city selected
  function clearActiveCity() {
      if (activeCity !== -1) {
        var saved = activeCity;
        var tween = new TWEEN.Tween( {scalePoint: 2, scaleText: 1} )
          .to({scalePoint: 1, scaleText: 0}, 200)
          .easing(TWEEN.Easing.Cubic.EaseOut)
          .onUpdate( function() {
            pointMesh[saved].scale.x = this.scalePoint;
            pointMesh[saved].scale.y = this.scalePoint;
            pointMesh[saved].updateMatrix();
          })
          .onComplete( function() {
          })
          .start();
            container.style.cursor = 'auto';

      }
      activeCity = -1;
    }

  function checkCityNearby(event){
  	var intersectPoint = objectPick(event);
  	if (intersectPoint !== null) {
  	  var city = findClosestCity(intersectPoint);
  	 
  	  if (city !== activeCity) {
  	    container.style.cursor = 'pointer';
  	    clearActiveCity();
  	    if(city > -1){
  	    	setActiveCity(city);
  	    	//alert(cities[city].title);
          console.log(cities[city])
          $('#popup .title').html(cities[city].title);
          $('#popup .price').html(cities[city].price);
          $('#popup .description').html(cities[city].description);
  	    	$('#popup, #overlay').fadeIn();
  	    }
  	    
  	  }
  	}

  }

 	$('#popup .close').on('touchend, click', function(){
 		$('#popup, #overlay').hide();
 	})

  

  function set_lat_lng(lat, lng) {

      target.x = (lng - 90) * Math.PI / 180.0;
      target.y = lat * Math.PI / 180.0;
      mouseDownOn =true;
     
  }

  $('#destinations a').on('touchend, click', function(e){
    zoom(-1000);
    var lat = $(this).attr('data-lat'),
        lng = $(this).attr('data-lng');

    set_lat_lng(lat, lng);
    var zoomInterval = setInterval(zoom(200), 2000);

    

  });

  // - Mouse events

  function onMouseDown(event) {
    event.preventDefault();


    container.addEventListener('mousemove', onMouseMove, false);
    container.addEventListener('mouseup', onMouseUp, false);
    container.addEventListener('mouseout', onMouseOut, false);

    mouseOnDown.x = - event.clientX;
    mouseOnDown.y = event.clientY;

    targetOnDown.x = target.x;
    targetOnDown.y = target.y;

    container.style.cursor = 'move';
  }

  function onMouseMove(event) {
  	
    mouse.x = - event.clientX;
    mouse.y = event.clientY;

    var zoomDamp = distance/1000;

    target.x = targetOnDown.x + (mouse.x - mouseOnDown.x) * 0.005 * zoomDamp;
    target.y = targetOnDown.y + (mouse.y - mouseOnDown.y) * 0.005 * zoomDamp;

    target.y = target.y > PI_HALF ? PI_HALF : target.y;
    target.y = target.y < - PI_HALF ? - PI_HALF : target.y;

  }

  function onMouseUp(event) {
    container.removeEventListener('mousemove', onMouseMove, false);
    container.removeEventListener('mouseup', onMouseUp, false);
    container.removeEventListener('mouseout', onMouseOut, false);
    container.style.cursor = 'auto';
   checkCityNearby(event);

  }

  function onMouseOut(event) {
    container.removeEventListener('mousemove', onMouseMove, false);
    container.removeEventListener('mouseup', onMouseUp, false);
    container.removeEventListener('mouseout', onMouseOut, false);
  }

  function onMouseWheel(event) {
    event.preventDefault();
    if (overRenderer) {
      zoom(event.wheelDeltaY * 0.3);
    }
    return false;
  }

  function onDocumentKeyDown(event) {
    switch (event.keyCode) {
      case 38:
        zoom(100);
        event.preventDefault();
        break;
      case 40:
        zoom(-100);
        event.preventDefault();
        break;
    }
  }

  function onWindowResize( event ) {
    camera.aspect = container.offsetWidth / container.offsetHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( container.offsetWidth, container.offsetHeight );
  }

  function zoom(delta) {
    setDistanceTarget( distanceTarget - delta );
  }

  function setDistanceTarget( value ){
    distanceTarget = Math.max( 350, Math.min( 1000, value ));
  }

  function animate() {
    requestAnimationFrame(animate);
    render();
  }

  var momentum = 0.99, momentumBoost = 1.5;
  var rotationPrev = {x:0,y:0};
  var rotationSpeed = {x:0,y:0};
  function render() {
    zoom(curZoomSpeed);
  
    if( mouseDownOn ){
      rotation.x += (target.x - rotation.x) * 0.1;
      rotation.y += (target.y - rotation.y) * 0.1;

      rotationSpeed.x = rotation.x - rotationPrev.x;
      rotationSpeed.y = rotation.y - rotationPrev.y;
    }else{
      rotation.x += momentumBoost * rotationSpeed.x;
      rotation.y += momentumBoost * rotationSpeed.y;

      rotationSpeed.x *= momentum;
      rotationSpeed.y *= momentum;
    }

    //limit the rotation at the poles
    var limitRotationY = 0.75 * PI_HALF;
    rotation.y = Math.max( - limitRotationY, Math.min( limitRotationY, rotation.y ) );
    
    distance += (distanceTarget - distance) * 0.3;

    camera.position.x = distance * Math.sin(rotation.x) * Math.cos(rotation.y);
    camera.position.y = distance * Math.sin(rotation.y);
    camera.position.z = distance * Math.cos(rotation.x) * Math.cos(rotation.y);

    camera.lookAt(sphere.position);
  
    renderer.render(scene, camera);
    //keep track of the rotation
    rotationPrev.x = rotation.x;
    rotationPrev.y = rotation.y;
  }

  init();
  this.animate = animate;


  this.__defineGetter__('time', function() {
    return this._time || 0;
  });

  this.__defineSetter__('time', function(t) {
    var validMorphs = [];
    var morphDict = this.points.morphTargetDictionary;
    for(var k in morphDict) {
      if(k.indexOf('morphPadding') < 0) {
        validMorphs.push(morphDict[k]);
      }
    }
    validMorphs.sort();
    var l = validMorphs.length-1;
    var scaledt = t*l+1;
    var index = Math.floor(scaledt);
    for (i=0;i<validMorphs.length;i++) {
      this.points.morphTargetInfluences[validMorphs[i]] = 0;
    }
    var lastIndex = index - 1;
    var leftover = scaledt - index;
    if (lastIndex >= 0) {
      this.points.morphTargetInfluences[lastIndex] = 1 - leftover;
    }
    this.points.morphTargetInfluences[index] = leftover;
    this._time = t;
  });

  this.addData = addData;
  this.createPoints = createPoints;
  this.renderer = renderer;
  this.scene = scene;

  return this;

};

