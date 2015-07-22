/**
 * XHR Request
 * @param  {Object}   data
 * @param  {Function} callback 
 */

var request = function (data, callback, type) {
		
		var xhr = new XMLHttpRequest();
		xhr.open(data.method, data.url, true);
		xhr.onreadystatechange = function (e) {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          if (callback) {
          		if (type === 'html'){
          			callback(xhr.responseText)
          		} else {
              	callback(JSON.parse(xhr.responseText));
            	}
          }
        }
      }
		};
		xhr.send(null);
  };


/**
 * Fetching data for globe, but not showing it yet
 * we'll call it with globe.animate() on first frame cta click
 */

var fetch = {
		templatePage: function (webgl, callback) {
			
			var url = webgl ? './templates/webgl_index.html' : './templates/nowebgl_index.html';
			var data = {
					url: url,
					method: 'GET'
        },
          
        parseResponse = function (response) {
        	if (callback) {
        		callback(response)
        	}
          
        };
			request(data, parseResponse, 'html');
		},

		countryData: function () {

			if (localStorage.getItem('wimCountry')) {
        if (localStorage.getItem('wimCountry') === 'GE') {
            localStorage.setItem('wimCountry','EU');
        }
         
				wimSettings.country = localStorage.getItem('wimCountry') === 'GE' ? 'EU' : localStorage.getItem('wimCountry');
				return;
			}


      function localStorageExist() {
        var tempKey = 'test';
        try {
          localStorage.setItem(tempKey, '1');
          localStorage.removeItem(tempKey);
          return true;
        } catch (error) {
          return false;
        }
      };

			wimSettings.country = wimSettings.regions[Math.floor(Math.random() * wimSettings.regions.length)];

      if ( localStorageExist() ) { 
			 localStorage.setItem('wimCountry', wimSettings.country);
      }
   
			//TODO - Uncomment if we actually go with country detection
      var data = {
          url: 'https://public-api.wordpress.com/geo/',
          method: 'GET'
        },
          
        parseResponse = function (response) {
          if (wimSettings[response.country_short]) {

            wimSettings.country = ( wimSettings.euCountries.indexOf(response.country_short) !== -1 ) ?   'EU' : response.country_short;

            if ( localStorageExist() ) { 
              localStorage.setItem('wimCountry', wimSettings.country);
            }

          }
        };
      request(data, parseResponse);
		},
		wimData: function () {
		
				 var data = {
						url: '../data/data.json?timestamp=' + new Date().getTime(),
						method: 'GET'
				  },
            
          parseResponse = function (response) {

          	var parsed_response = [];

          	for (var i = 0; i < response.keys.length; i++) {
          		var k = response.keys[i];
							window[k] = response[k];
          		
          		if (!wimSettings.webgl) {
          			var countryCode = k.split('data')[1];
          					
          			if (countryCode) {
          				var countryData = countryCode === 'GE'? response[k].slice(0, 5) : response[k];
          				globe.liteVersion(countryCode, countryData);
          			}
          			
	          	} else {
								parsed_response.push.apply(parsed_response, response[k]);
							}

          	}

						if (wimSettings.webgl) {
          		globe.addData(parsed_response);
          	}
          	document.body.style.backgroundImage = 'none';

          };
			
				
				request(data, parseResponse);
		}
  };