$(function() {

	
	var globe = DAT.Globe(document.getElementById('container'), {
	    colorFn: function(label) {
	       //return new THREE.Color(0xEE0000);
	       return new THREE.Color(0xffffff);
	    }
	  });

	  var xhr = new XMLHttpRequest();
	  xhr.open('GET', '/Pixel/destinations.json', true);
	  xhr.onreadystatechange = function(e) {
	    if (xhr.readyState === 4) {
	      if (xhr.status === 200) {
	        var data = JSON.parse(xhr.responseText);
	        window.data = data;
			var parsed_response = [];
			
			for (var i = 0; i < data.length; i++) {
	          		var k = data[i];
					parsed_response.push.apply(parsed_response, data[i]);
		
	          	}

			globe.addData(data, {format: 'magnitude'});
				
	        globe.createPoints();
	        globe.animate();
	        document.body.style.backgroundImage = 'none'; // remove loading
	      }
	    }
	  };
	  xhr.send(null);
});