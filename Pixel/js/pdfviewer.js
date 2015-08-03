
$(function() {
	var currentPage = 1;
	$('.view-brochure').on('click', function(e){
		//reset to page 1
		currentPage = 1;
		$("#flipbook").turn("page", currentPage);
		$('#popup').hide();
		$('#popup-brochure').fadeIn();
	});

	$('#popup-brochure .close').on('click', function(e){
		$('#popup').fadeIn();
		$('#popup-brochure').hide();
	});

	$('#flipbook').hide();

		PDFJS.getDocument('./pdf/flex.pdf').then(function(pdf) {
			
			var totalPages = pdf.pdfInfo.numPages;
			for(var i = 1; i <= totalPages; i ++){
				pdf.getPage(i).then(function(page) {
						scale = 1;
						viewport = page.getViewport(scale);
						//set up individual pages for flipbook
						$('#flipbook').append("<div><canvas id='page-" + page.pageIndex + "'></canvas></div>")
						canvas = document.getElementById("page-" + page.pageIndex + "");
						context = canvas.getContext("2d");
						canvas.height = viewport.height;
						canvas.width = viewport.width;
						renderContext = {
							canvasContext: context,
							viewport: viewport
						};
						
						//check promise
						page.render(renderContext).promise.then(function(){
							//if total page
							if(currentPage < totalPages){
								currentPage++;
							}else{
								setTimeout(function(){ initFlipBook() }, 1000);
							}

						});

					});

			}
			
		});
		function initFlipBook(){
				$("#flipbook").turn({
					width: 820,
					height: 600,
					autoCenter: true,
					acceleration: true,
					gradients: !$.isTouch,
					elevation:50,
					when: {
							turned: function(e, page) {
									/*console.log('Current view: ', $(this).turn('view'));*/
							}
					}
				});
				$('#flipbook').fadeIn();
			
		}
});