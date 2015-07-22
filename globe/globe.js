var DAT = DAT || {},
  initZoom,
  initCard;

DAT.Globe = function(container, opts) {
  opts = opts || {};
  
  colorFn = opts.colorFn || function (color) {
    var c = new THREE.Color();
    c.setStyle(color);
    return c;
  };

  var imgDir = opts.imgDir || '/globe/',
    Shaders = {
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
				  'vec3 atmosphere = vec3( 1.0, 0.0, 1.0 ) * pow( intensity, 3.0 );',
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
				  'gl_FragColor = vec4( 1.0, 0.5, 0.5, 1.0 ) * intensity;',
				  '}'
				].join('\n')
      }
    },


    camera,
    scene,
    renderer,
    projector,
    sphere,
    point,
    atmosphereMesh,
  //global meshes
    pointMesh = [],
    stopaMesh = [],
    dotMesh = [], 
  	dotData = [], //this array will clone scale.z data needed to remember line height for each dot when filtering
    circleMesh,
    focusCircles = [],
    innerRadius,
    cities = [],
    activeCity = -1,
    testArr = [],
    overRenderer = false,
    curZoomSpeed = 0,
    mouse = { x: 0, y: 0 },
    mouseOnDown = { x: 0, y: 0 },
    mouseDownOn = false,
    rotation = { x: 4, y: 1 },
    target = { x: Math.PI * 3 / 2, y: Math.PI / 6.0 },
    targetOnDown = { x: 0, y: 0 },
    distance = 10000,
    distanceTarget = 10000,
    delayTimer,
    focusTimer;

	/**
	 * Initialize globe
	 */
  function init() {
		
		var shader, uniforms, material, w, h;

    container.style.color = '#fff';
    container.style.font = '13px/20px Arial, sans-serif';

    w = container.offsetWidth || window.innerWidth;
    h = container.offsetHeight || window.innerHeight;

    // camera & scene {{{
    camera = new THREE.PerspectiveCamera(30, w / h, 1, 20000);
    camera.position.z = distance;
    

    projector = new THREE.Projector();
    scene = new THREE.Scene();
    // }}}

    // globe {{{
    var geometry = new THREE.SphereGeometry(200, 40, 30);

    shader = Shaders.earth;
    uniforms = THREE.UniformsUtils.clone(shader.uniforms);

    //THREE.ImageUtils.crossOrigin = "http://qz.com";

		uniforms.texture.value = THREE.ImageUtils.loadTexture(imgDir + 'world.jpg');

		material = new THREE.ShaderMaterial({

      uniforms: uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader

		});

		sphere = new THREE.Mesh(geometry, material);
		sphere.rotation.y = Math.PI;
		scene.add(sphere);
    // }}}

    // atmosphere {{{
    shader = Shaders.atmosphere;
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
    atmosphereMesh.scale.set(1.1, 1.1, 1.1);
    atmosphereMesh.name = 'atmosphere';
    scene.add(atmosphereMesh);
    // }}}
		
	

    // hollow-circle && focus-circle {{{
    geometry = new THREE.Geometry();

    for (var i = 0; i <= 32; i += 1) {
      var x = Math.cos(i / 32 * 2 * Math.PI),
        y = Math.sin(i / 32 * 2 * Math.PI),
        vertex = new THREE.Vector3(x, y, 0);
      geometry.vertices.push(vertex);
    }
    material = new THREE.LineBasicMaterial({
      color: 0xcccccc,
      linewidth: 1
    });
    circleMesh = new THREE.Line(geometry, material);
    for (i = 0; i < 3; i += 1) {
      focusCircles.push(circleMesh.clone());
    }
    for (i = 0; i < 3; i += 1) {
      focusCircles[i].visible = false;
      scene.add(focusCircles[i]);
    }
    // }}}


    
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(w, h);
    renderer.domElement.style.position = 'absolute';

    container.appendChild(renderer.domElement);
    container.addEventListener('mousedown', onMouseDown, false);
    container.addEventListener('mousemove', onMouseMove, false);
    container.addEventListener('mouseover', function () {
      overRenderer = true;
    }, false);
    container.addEventListener('mouseout', function () {
      overRenderer = false;
      clearActiveCity();
    }, false);


    camera.aspect = window.innerWidth / window.innerHeight;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.updateProjectionMatrix();
  }

	/** 
	 * Add cities on globe
	 */
  function addCity(lat, lng, size, city, color, img, slideshowURL) {
    var material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: THREE.FaceColors
    }),

    phi = (90 - lat) * Math.PI / 180,
    theta = (180 - lng) * Math.PI / 180,
	
	point3d = new THREE.BoxGeometry(1, 1, 0.5);
  	point = new THREE.Mesh(point3d, material);
    
	
    point.position.x = 200 * Math.sin(phi) * Math.cos(theta);
    point.position.y = 200 * Math.cos(phi);
    point.position.z = 200 * Math.sin(phi) * Math.sin(theta);

    point.scale.z = Math.max(size, 0.1); // avoid non-invertible matrix
		
    point.lookAt(sphere.position);
    var i;

    for (i = 0; i < point.geometry.faces.length; i++) {
      point.geometry.faces[i].color = color;
    }
      
	
		
	//Stopa
    var stopalo = new THREE.CylinderGeometry(2, 2, 0, 14, 0, false);
    stopa = new THREE.Mesh(stopalo, material);

    stopa.position.x = 200 * Math.sin(phi) * Math.cos(theta);
    stopa.position.y = 200 * Math.cos(phi);
    stopa.position.z = 200 * Math.sin(phi) * Math.sin(theta);

    stopa.themeState = 'on';
    stopa.formatState = 'on';
    

    //rotate the cylinder
    stopalo.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  
    stopa.lookAt(sphere.position);
    

    for (i = 0; i < stopa.geometry.faces.length; i++) {
      stopa.geometry.faces[i].color = color;
    }

		
		// cities.push({'position': point.position.clone(), 'img': img, 'color' : color, 'size' : size, 'lat' : lat, 'lng' : lng, 'title' : title, 'desc' : desc, 'link': link, 'themes' : themes, 'format' : format, 'region': region, 'slideshowURL': slideshowURL});
  }
	
		
/*	var addData = function(data) {
	
	  var lat, lng, size, color, img, i, colorFnWrapper, slideshowURL;

    colorFnWrapper = function(data, i) { return colorFn(); };

    
 
		
		for (i = 0; i < data.length ; i++) {

			color = colorFnWrapper(data, i);

			city = data[i][0];
			lat = data[i][1];
			lng = data[i][2];

			//converting date to size based on number of days
			var minMilli = 1000 * 60;
			var hrMilli = minMilli * 60;
			var dyMilli = hrMilli * 24;

			var testDate = Date.parse(new Date());
			var testDate2 = Date.parse(data[i][3]);
			var ms = testDate-testDate2;
			var days = Math.round(ms / dyMilli);

			//With days we"re getting proper values, but we want to display them in reverse order: greater the number of days, taller the line and vice versa
			size = 2*365-days;

			//fallback if the line becomes too small
			if (size < 100) {
				size = 100;
			}

			//or too big
			if ( size > 800 ) {
				size = 800;
			}


			img = data[i][4];
			title = data[i][5];
			desc = data[i][6];
			link = data[i][7];
			themes = data[i][8];
			format = data[i][9];
			region = data[i][10];

			if (format === 'slideshow') {
				slideshowURL = data[i][11];
			}
     
      addCity(lat, lng, size, city, color, img, slideshowURL, themes, format);
     
			
			//Themes filter
			switch (themes){
				case 'industrial internet':
				color.setStyle('#f7c438');
				break;
				case 'energy':
				color.setStyle('#d2fd3a');
				break;
				case 'healthcare':
				color.setStyle('#d77fe8');
				break;
				case 'skills & work':
				color.setStyle('#4edee2');
				break;
				case 'transportation':
				color.setStyle('#ff8046');
				break;
				case 'manufacturing':
				color.setStyle('#d3217a');
				break;
				case 'infrastructure':
				color.setStyle('#35ba8a');
				break;
				case 'gestore':
				color.setStyle('#ed0959');
				break;
				default: color.setStyle('white');
			}
			
			
			pointMesh.push(point);
			stopaMesh.push(stopa);

			//meshes holding both line and bottom circle (stopa) for animating lines
			dotMesh.push(point, stopa);
			dotData.push(point.scale.z, stopa.scale.z);
			
			scene.add(point);
			scene.add(stopa);
		}
  };
  */
  
  function addData(data, opts) {
		var lat, lng, size, color, img, i, colorFnWrapper, slideshowURL;
		
		opts.animated = opts.animated || false;
		this.is_animated = opts.animated;
		step = 4;
		colorFnWrapper = function(data, i) { return colorFn(2); }

		var subgeo = new THREE.Geometry();
		
		for (i = 0; i < data.length ; i++) {
			
			 lat = data[i][0];
			 lng = data[i][1];
			 size = 50;
			 step = 4;
			 color = colorFnWrapper(data[i], 0);
			 addCity(lat, lng, size, color, subgeo);
			 
			alert(lat +":"+lng+":"+size+":"+color);
			
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

				
	//Article		
	/* articleF.click(function() {
		
		$(this).toggleClass('off');
		 	
		if ($(this).hasClass('off')) {
			
			$.each(dotMesh, function(index, value) {

				if (dotMesh[index].format === 'article') {

					dotMesh[index].formatState = 'off';

					if (dotMesh[index].themeState !== 'off') {

						var tween = new TWEEN.Tween( {scaleZ: dotData[index]} )
		        .to({scaleZ: 1}, 200)
		        .easing(TWEEN.Easing.Cubic.EaseOut)
		        .onUpdate( function() {
		          dotMesh[index].scale.z = this.scaleZ;
		        })
		        .onComplete( function() {
		          dotMesh[index].visible = false;
		        })
		        .start();
		      }
        }
			});
		}
		else {
			$.each(dotMesh, function(index, value) {

				if (dotMesh[index].format === 'article') {

					dotMesh[index].formatState = 'on';

					if (dotMesh[index].themeState !== 'off') {

						var tween = new TWEEN.Tween( {scaleZ: 0} )
		        .to({scaleZ: dotData[index]}, 200)
		        .easing(TWEEN.Easing.Cubic.EaseOut)
		        .onUpdate( function() {
							dotMesh[index].visible = true;
		          dotMesh[index].scale.z = this.scaleZ;
		        })
		        .start();
			    }
				}
			});
		}
	}); */
	

  function objectPick(event) {
    var vector = new THREE.Vector3((event.clientX / window.innerWidth) * 2 - 1, - (event.clientY / window.innerHeight) * 2 + 1, 0.5);
    projector.unprojectVector(vector, camera);
    var raycaster = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());
    var intersects = raycaster.intersectObject(sphere);

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
				//Checking if any of the filters is turned on - otherwise point would remain clickable even if the line is hidden
					// if (cities[i].format === 'article' && articleF.hasClass('off') || cities[i].format === 'slideshow' && slideshowF.hasClass('off') || cities[i].format === 'video' && videoF.hasClass('off') || cities[i].format === 'infographic' && infographicF.hasClass('off') || cities[i].format === 'social' && socialF.hasClass('off') || cities[i].themes === 'industrial internet' && internetT.hasClass('off') || cities[i].themes === 'energy' && energyT.hasClass('off') || cities[i].themes === 'healthcare' && healthT.hasClass('off') || cities[i].themes === 'skills & work' && skillsT.hasClass('off') || cities[i].themes === 'transportation' && transportationT.hasClass('off') || cities[i].themes === 'manufacturing' && manufacturingT.hasClass('off') || cities[i].themes === 'infrastructure' && infrastructureT.hasClass('off') || cities[i].themes === 'gestore' && gestoreT.hasClass('off')) {
						best = 0;
					// }
      }
    }

    if (index === -1 || best < 0.9998) {
      return -1;
    }
		
    return index;
  }

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

      for (var i = 0; i < 3; i += 1) {
        focusCircles[i].visible = false;
        focusCircles[i].scale.x = 1;
        focusCircles[i].scale.y = 1;
      }
      clearInterval(focusTimer);
    }
    activeCity = -1;
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
  
      for (var i = 0; i < 3; i += 1) {
        focusCircles[i].position = cities[activeCity].position;
        focusCircles[i].lookAt(sphere.position);
      }
      innerRadius = 0;
      focusTimer = setInterval( function() {
        var radius = innerRadius;
        for (var i = 0; i < 3; i += 1) {
          if (radius <= 12) {
            focusCircles[i].scale.x = radius / 4 + 1;
            focusCircles[i].scale.y = radius / 4 + 1;
          }
          radius += 3;
        }
        innerRadius += 1;
        if (innerRadius >= 12) {
          innerRadius = 0;
        }
      }, 120);
      for (i = 0; i < 3; i += 1) {
        focusCircles[i].visible = true;
      }
    }
  }

  function onMouseDown(event) {
  	
    event.preventDefault();

    container.addEventListener('mouseup', onMouseUp, false);
    container.addEventListener('mouseout', onMouseOut, false);

    mouseOnDown.x = - event.clientX;
    mouseOnDown.y = event.clientY;

    targetOnDown.x = target.x;
    targetOnDown.y = target.y;

    container.style.cursor = 'move';

    mouseDownOn = true;
  }
  
  function onMouseMove(event) {

    if (mouseDownOn === true) {
      mouse.x = - event.clientX;
      mouse.y = event.clientY;

      var zoomDamp = distance / 1000;

      target.x = targetOnDown.x + (mouse.x - mouseOnDown.x) * 0.005 * zoomDamp;
      target.y = targetOnDown.y + (mouse.y - mouseOnDown.y) * 0.005 * zoomDamp;

      target.y = target.y > Math.PI/2 ? Math.PI/2 : target.y;
      target.y = target.y < -Math.PI/2 ? -Math.PI/2 : target.y;

      clearActiveCity();
    } else {
      clearTimeout(delayTimer);
      delayTimer = setTimeout(function() {
        var intersectPoint = objectPick(event);
        if (intersectPoint !== null) {
          var city = findClosestCity(intersectPoint);
          if (city !== activeCity) {
            container.style.cursor = 'pointer';
            clearActiveCity();
            setActiveCity(city);
          }
        }
      }, 10);
    }  
  }


  function onMouseUp(event) {
    container.removeEventListener('mouseup', onMouseUp, false);
    container.removeEventListener('mouseout', onMouseOut, false);
    container.style.cursor = 'auto';

    if (activeCity != -1) {
			///////POPUP CONTENT/////////
			
			//getting click coordinates
			var x = event.clientX;
			var y = event.clientY;

      var card = cities[activeCity].title;
			
      
      //setting background image
      var bgImg = 'url(' + cities[activeCity].img + ')';

      //POPUP
      overlay.velocity('fadeIn', { duration: 250 });
			popup.velocity('fadeIn', { duration: 250 });
      popup.css('background-image', bgImg);
			

 			//article		
			videoLink.hide();
			slideshowLink.hide();
			aLink.show();
      aTitle.html(cities[activeCity].title).css('color', cities[activeCity].color.getStyle());
			aDesc.html(cities[activeCity].desc);
			aLink.attr('href', cities[activeCity].link).css('background-color', cities[activeCity].color.getStyle());
			
			videoLink.css('background-color', cities[activeCity].color.getStyle());
			slideshowLink.css('background-color', cities[activeCity].color.getStyle());

			tagTheme.html(cities[activeCity].themes).css('color', cities[activeCity].color.getStyle());
			tagFormat.html(cities[activeCity].format);
			$('.article').show();
						
				//social shares
			
				$('.fb').attr('href' , 'https://www.facebook.com/sharer/sharer.php?u=' + cities[activeCity].link + '&t=' + cities[activeCity].title);
				$('.twitter').attr('href' , 'https://twitter.com/intent/tweet?text=%23GEWorldInMotion ' + cities[activeCity].title + ': ' + cities[activeCity].link);
				$('.linkedin').attr('href', 'http://www.linkedin.com/shareArticle?mini=true&url=' + cities[activeCity].link + '&title=%23GEWorldInMotion ' + cities[activeCity].title);
			
			
			//slideshow
	 		if(cities[activeCity].format === 'slideshow') {
			
				$('.images').css('background-image', 'url("' + cities[activeCity].link[0] + '")');

				//hiding social share icons since there is no link to be shared
				$('.social').hide();

				$('.slideshow-url a').attr('href', cities[activeCity].slideshowURL).css('color', aLink.css('background-color'));
	 			$('.slideshow-url').show();

				slideshowLink.show();
				aLink.hide();
				
				slideshowLink.on('click', function() {
					slideshowContainer.show();
				});


				slideshowStart = (function() {

		     	var images = [],
		     	curIndex = 0;
		      
		      for (var i = 0; i < cities[activeCity].link.length; i++) {
		        images.push(cities[activeCity].link[i]);
		      }
		      
		      var gotoImage = function (index) {
		      	
              
		          $('.images').each(function (i) {
		             var image = curIndex + i;
		              if (image >= images.length) {
		                  image = image - images.length;
		              }
		             $(this).css("background-image", 'url("' + images[image] + '")');
		          });
		      };

					return {
							next: function() {
								
		            curIndex++;
		            if (curIndex === images.length) {
		                curIndex = 0;
		            }
		            gotoImage(curIndex);
							},
							prev: function() {

		            curIndex--;
		            if (curIndex === -1) {
		                curIndex = images.length - 1;
		            }
		            gotoImage(curIndex);
							}
					};
				})();				
			}
			else {
				$('.social').show();
				$('.slideshow-url').hide();
				slideshowContainer.hide();
			}

								//very quick  fix - for preview only
						if (cities[activeCity].lng === 75.3629674) {
							slideshowContainer.addClass('big-slider');
						}
						else {
							slideshowContainer.removeClass('big-slider');
						}
			



			//Arrows listing/navigation	
			var i = 0;
			testArr = [];



			//India
			if (cities[activeCity].region === 'India') {
				while (i < dataIN.length) {
					if (dataIN[i][8] === cities[activeCity].themes) {
						 testArr.push(dataIN[i]);
					}
					i++;
				}
			}
			//Africa
			else if (cities[activeCity].region === 'Africa') {
				while (i < dataAF.length) {
					if (dataAF[i][8] === cities[activeCity].themes) {
						testArr.push(dataAF[i]);
					}
					i++;
				}
			}
			//Europe
			else if (cities[activeCity].region === 'Europe') {
				while (i < dataEU.length) {
					if (dataEU[i][8] === cities[activeCity].themes) {
						testArr.push(dataEU[i]);
					}
					i++;
				}
			}
			//Canada
			else if (cities[activeCity].region === 'Canada') {
				while (i < dataCA.length) {
					if (dataCA[i][8] === cities[activeCity].themes) {
						testArr.push(dataCA[i]);
					}
					i++;
				}
			}			
			//Australia
			else if (cities[activeCity].region === 'Australia') {
				while (i < dataAU.length) {
					if (dataAU[i][8] === cities[activeCity].themes) {
						testArr.push(dataAU[i]);
					}
					i++;
				}
			}
			//US
			else if (cities[activeCity].region === 'US') {
				while (i < dataUS.length) {
					if (dataUS[i][8] === cities[activeCity].themes) {
						testArr.push(dataUS[i]);
					}
					i++;
				}
			}
      //GE Reports
			else if (cities[activeCity].region === 'gestore') {
				while (i < dataGESTORE.length) {
					if (dataGESTORE[i][8] === cities[activeCity].themes) {
						testArr.push(dataGESTORE[i]);
					}
					i++;
				}
			}
      //Japan
			else if (cities[activeCity].region === 'japan') {
				while (i < dataJP.length) {
					if (dataJP[i][8] === cities[activeCity].themes) {
						testArr.push(dataJP[i]);
					}
					i++;
				}
			}
      //MENAT
			else if (cities[activeCity].region === 'menat') {
				while (i < dataMENAT.length) {
					if (dataMENAT[i][8] === cities[activeCity].themes) {
						testArr.push(dataMENAT[i]);
					}
					i++;
				}
			}
			//China
			else if (cities[activeCity].region === 'china') {
				while (i < dataCN.length) {
					if (dataCN[i][8] === cities[activeCity].themes) {
						testArr.push(dataCN[i]);
					}
					i++;
				}
			}
			//Brazil
			else if (cities[activeCity].region === 'brazil') {
				while (i < dataBR.length) {
					if (dataBR[i][8] === cities[activeCity].themes) {
						testArr.push(dataBR[i]);
					}
					i++;
				}
			}
      //Korea
      else if (cities[activeCity].region === 'korea') {
        while (i < dataKR.length) {
          if (dataKR[i][8] === cities[activeCity].themes) {
            testArr.push(dataKR[i]);
          }
          i++;
        }
      }       		


      //TESTING ANALYTICS
      //piwik
      popup.attr('data-content-name', aTitle.html());
			
			//GA
			var contentPiece = $('.article-title').html();
			ga('send', {
			  'hitType': 'event',          // Required.
			  'eventCategory': 'content',   // Required.
			  'eventAction': 'click',      // Required.
			  'eventLabel': contentPiece,
			  'eventValue': 4
			});
	
		 arrowNav = (function() {
			var currentDot = -1;

			if (testArr.length === 1) {
				$('.nav-arrow-next, .nav-arrow-prev').hide();
			} else {
				$('.nav-arrow-next, .nav-arrow-prev').show();
			}
			return {
					next: function() {

						if (currentDot >= testArr.length - 1) {
							currentDot = -1;
						}
						currentDot++;

						arrowContent(currentDot);
					},
					prev: function() {
						
						currentDot--;

						if (currentDot < 0) {
							currentDot = testArr.length - 1;
						}

						arrowContent(currentDot);
					}
			};
		})();

			var arrowContent = function(currentDot) {
            var card2 = testArr[currentDot][5]
						aLink.show();
						aTitle.html(testArr[currentDot][5]);
						aDesc.html(testArr[currentDot][6]);
						aLink.attr('href', testArr[currentDot][7]);
						popup.css('background-image', 'url(' + testArr[currentDot][4] + ')');
						tagFormat.html(testArr[currentDot][9]);


						$('.fb').attr('href' , 'https://www.facebook.com/sharer/sharer.php?u=' + testArr[currentDot][7] + '&t=' + testArr[currentDot][5]);
						$('.twitter').attr('href' , 'https://twitter.com/intent/tweet?text=%23GEWorldInMotion ' + testArr[currentDot][5] + ': ' + testArr[currentDot][7]);
						$('.linkedin').attr('href', 'http://www.linkedin.com/shareArticle?mini=true&url=' + testArr[currentDot][7] + '&title=%23GEWorldInMotion ' + testArr[currentDot][5]);



						//testing analytics
      			$('.nav-arrow-next').attr('data-content-name', aTitle.html());
      			$('.nav-arrow-prev').attr('data-content-name', aTitle.html());
						
						if(testArr[currentDot][9] === 'video') {
								videoContainer.html("<iframe width='531' height='387' src=" + "'" + testArr[currentDot][7] + "'" + "frameborder='0' allowfullscreen></iframe>");
								aLink.hide();
								videoLink.show();
								videoLink.on('click', function() {
                  
									videoContainer.show();
								});

								$('.x').css('margin-right', '20px');
						}
      			else {
        			videoContainer.empty();
							videoContainer.hide();
							videoLink.hide();
							$('.x').css('margin-right', 0);
      			}
						
				//social
       if(testArr[currentDot][9] === 'social') {
					$('.article').hide();
					popup.css('background-image', 'none').css('width', '354px').css('height', '258px');
					$('.insta').html("<iframe width='354' height='440' src=" + "'" + testArr[currentDot][7] + "'" + "frameborder='0' allowfullscreen><base target='_blank' /></iframe>");
					$('.insta').show();
				}
				else {
					$('.article').show();
					$('.insta').hide();
					$('.insta').empty();
					popup.css('width', '531px').css('height', '387px');
      	}
						
				//slideshow
	 			if(testArr[currentDot][9] === 'slideshow') {

	 			$('.social').hide();

	 			$('.slideshow-url a').attr('href', testArr[currentDot][11]).css('color', aLink.css('background-color'));
	 			$('.slideshow-url').show();
				
				$('.images').css("background-image", 'url("' + testArr[currentDot][7][0] + '")');


				slideshowLink.show();
				aLink.hide();
				
				slideshowLink.on('click', function() {
					slideshowContainer.show();
				});



				slideshowStart = (function() {

		     	var images = [],
		     	curIndex = 0;
		      
		      for (var i = 0; i < testArr[currentDot][7].length; i++) {
		        images.push(testArr[currentDot][7][i]);
		      }
		      
		      var gotoImage = function (index) {
		          $('.images').each(function (i) {
		             var image = curIndex + i;
		              if (image >= images.length) {
		                  image = image - images.length;
		              }
		             $(this).css("background-image", 'url("' + images[image] + '")');
		          });
		      };

					return {
							next: function() {
		            curIndex++;
		            if (curIndex === images.length) {
		                curIndex = 0;
		            }
		            gotoImage(curIndex);
							},
							prev: function() {
		            curIndex--;
		            if (curIndex === -1) {
		                curIndex = images.length - 1;
		            }
		            gotoImage(curIndex);
							}
					};
				})();
			}

			else {
				$('.social').show();
				$('.slideshow-url').hide();
				slideshowLink.hide();
				slideshowContainer.hide();
			}
					
				
						//very quick  fix - for preview only
						if (testArr[currentDot][2] === 75.3629674) {
							slideshowContainer.addClass('big-slider');
						}
						else {
							slideshowContainer.removeClass('big-slider');
						}
		};

		
      
      //video
      if(cities[activeCity].format === 'video') {
        videoContainer.html("<iframe width='531' height='387' src=" + "'" + cities[activeCity].link + "'" + "frameborder='0' allowfullscreen></iframe>");
       	aLink.hide();
				videoLink.show();
				videoLink.on('click', function() {
          
					videoContainer.show();
				});

				$('.x').css('margin-right', '20px');

      }
      else {
        videoContainer.empty();
				videoLink.hide();
				$('.x').css('margin-right', 0);
      }
      
      //social
       if(cities[activeCity].format === 'social') {
				$('.article').hide();
				popup.css('background-image', 'none').css('width', '354px').css('height', '258px');
        $('.insta').html("<iframe width='354' height='440' src=" + "'" + cities[activeCity].link + "'" + "frameborder='0' allowfullscreen><base target='_blank' /></iframe>");
        $('.insta').show();
      }
      else {
				$('.insta').hide();
        $('.insta').empty();
        popup.css('width', '531px').css('height', '387px');
      }
      
    }
    mouseDownOn = false;
  }




  function onMouseOut(event) {
    container.removeEventListener('mouseup', onMouseUp, false);
    container.removeEventListener('mouseout', onMouseOut, false);
    container.style.cursor = 'auto';

    mouseDownOn = false;
  }

  function onMouseWheel(event) {
  	event.preventDefault();
    if (overRenderer) {
      zoom(event.wheelDeltaY * 0.3);
    }
  	return false;
  }

 
  function zoom(delta) {
    distanceTarget -= delta;
    distanceTarget = distanceTarget > 1000 ? 1000 : distanceTarget;
    distanceTarget = distanceTarget < 530 ? 530 : distanceTarget;
  }
	

  function rotate(delta) {
    target.x -= delta;
  }
	
	//initial zoom

initZoom = function() {

	setTimeout(function() {
		var tween = new TWEEN.Tween( {value: 1000} )
			.to({value:780}, 2000)
			.easing(TWEEN.Easing.Cubic.EaseOut)
			.onUpdate( function() {
				distanceTarget = this.value;
			})
			.onComplete( function() {
        if (!GLOBE_ONLY || GE_INTRO) {
				  container.addEventListener('mousewheel', onMouseWheel, false);
        }
				document.addEventListener('keydown', onDocumentKeyDown, false);
				zoomClick();
			})
			.start();
	}, 1700);

};

/**
 * Initialize fade in card once globe is active
 */
initCard = function() {

	setTimeout(function() {
		
		var tempArr = [],
				i=0;

		while (i < dataUS.length) {
			if (dataUS[i][9] === 'article') {
				tempArr.push(dataUS[i]);
			}
			i++;
		}

	  var k = Math.floor(Math.random() * tempArr.length);
				videoLink.hide();
				slideshowLink.hide();
				aLink.show();
				overlay.velocity('fadeIn', { duration: 2000 });
				popup.velocity('fadeIn', { duration: 2000 });
				popup.css('background-image', 'url(' + tempArr[k][4] + ')');
				aTitle.html(tempArr[k][5]);
				aDesc.html(tempArr[k][6]);
				aLink.attr('href', tempArr[k][7]);
				tagTheme.html(tempArr[k][8]);
				tagFormat.html('article');
			
		
		setTimeout(function() {
			overlay.velocity('fadeOut', { duration: 1000 });
			popup.velocity('fadeOut', { duration: 1000 });
		}, 2000);

	}, 2000);	
};

function animate() {
	requestAnimationFrame(animate);

	zoom(curZoomSpeed);

	rotation.x += (target.x - rotation.x) * 0.1;
	rotation.y += (target.y - rotation.y) * 0.1;
	distance += (distanceTarget - distance) * 0.3;


	camera.position.x = distance * Math.sin(rotation.x) * Math.cos(rotation.y);
	camera.position.y = distance * Math.sin(rotation.y);
	camera.position.z = distance * Math.cos(rotation.x) * Math.cos(rotation.y);

	camera.lookAt(sphere.position);

	renderer.render(scene, camera);

	TWEEN.update();
}

  init();
  
  this.animate = animate;
  this.addData = addData;
  this.renderer = renderer;
  this.scene = scene;

  return this;
};