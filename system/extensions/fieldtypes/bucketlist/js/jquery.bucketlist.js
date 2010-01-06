/**
 * BucketList JavaScript. Handles the creation and display of the file
 * tree, and uploading.
 *
 * Original inspiration for the file tree code came from a jQuery plugin
 * by Cory S.N. LaViska (http://abeautifulsite.net).
 *
 * @package		BucketList
 * @author 		Stephen Lewis (http://eepro.co.uk/)
 * @copyright 	Copyright (c) 2009, Stephen Lewis
 * @link 		http://eepro.co.uk/bucketlist/
 */

(function($) {

$.fn.bucketlist = function(options) {
	
	// Build main options.
	var globalOptions = $.extend({}, $.fn.bucketlist.defaults, options);
	
	// Iterate through each element.
	return this.each(function() {
		
		// Convenience variable.
		var $this = $(this);
		
		// Element-specific options.
		var localOptions = $.meta ? $.extend({}, globalOptions, $this.data()) : globalOptions;
		
		// In-progress uploads.
		var uploads = {};
		
		// Flag to hide the initial loading message.
		var initialLoad = true;
		
		// In case this ever changes.
		var slash = '%2F';
		
		/**
		 * Retrieve the initialFile, if it has been supplied. Note that
		 * it will be rawurlencoded. We don't decode it (see showTree
		 * for a rant on this), instead we split it using the encoded
		 * slash.
		 */
		
		if (localOptions.initialFile) {
			var initialFilePath = localOptions.initialFile.split(slash);
			var initialFileStep = 0;
		}
		
		
		
		/**
		 * ----------------------------------------------------------
		 * GENERAL FUNCTIONS
		 * ----------------------------------------------------------
		 */
		
		/**
		 * Retrieves the specified item from the languageStrings object.
		 * If the item does not exist, the supplied ID is returned.
		 *
		 * @access	private
		 * @param	string		id		The language string ID.
		 */
		function getLanguageString(id) {
			return (languageStrings['id'] == 'undefined') ? id : languageString['id'];
		}; /* getLanguageString */
		
		
		
		/**
		 * ----------------------------------------------------------
		 * UPLOADING FUNCTIONS
		 * ----------------------------------------------------------
		 */
		
		/**
		 * Initialises the 'upload' link in the specified branch. Wraps it
		 * in a div, and creates a new "file" input element.
		 *
		 * @access	private
		 * @param 	object		$root			A jQuery object containing the root of this branch.
		 * @param 	string 		bucketName		The name of the current bucket.
		 * @param	string		filePath		The path to the current folder.
		 * @return 	void
		 */
		function initializeUpload($root, path) {
			
			var $uploadLink = $root.find('.upload a');
			
			if ($uploadLink.length == 0) {
				// Nothing more we can do here.
				return false;
			}

			// Create the element wrapper, and append the file element.
			$uploadLink.wrap('<div class="bucketload"></div>');
			
			// Create the file element.
			createFile($uploadLink.parent());
			
			// Create a hidden fields to hold the path information.
			// $uploadLink.parent().append('<input type="hidden" name="bucket" value="' + bucketName + '">');
			
			$uploadLink.parent().append('<input type="hidden" name="path" value="' + path + '">');
			
			// If this is an anchor (which it should be), disable the default click event.
			if ($uploadLink[0].nodeName.toLowerCase() == 'a') {
				$uploadLink.bind('click', function(e) {
					return false;
				});
			}

			/**
			 * Sneakiness, to keep the file element's "Browse" button underneath the mouse
			 * pointer whenever the user mouses-over the .bucketload container.
			 *
			 * The ridiculous hoops we still have to jump through to get anything halfway
			 * decent on the web make me weep.
			 */

			$uploadLink.parent().bind('mousemove', function(e) {

				var $file	= $(this).find('input[type="file"]');

				var offset	= $(this).offset();
				var fileX	= e.pageX - offset.left - ($file.width() - 30);
				var fileY	= e.pageY - offset.top - ($file.height() / 2);

				$file.css('left', fileX);
				$file.css('top', fileY);

			});

		}; /* initializeUpload */
		
		
		/**
		 * Handles the Amazon response.
		 *
		 * @access	private
		 * @param 	object		e		The jQuery event object.
		 * @return 	void
		 */
		function amazonResponse(e) {
			
			// Shorthand.
			var $iframe = $(e.target);

			/**
			 * There is much sneakiness afoot. I've heard talk around t'interwebs
			 * of dynamically generated iframe forms being re-submitted on page
			 * reload.
			 *
			 * Quite how or why this would happen is beyond me, and I've been unable
			 * to reproduce this fabled condition. However, the fix is simple enough,
			 * so I've included it regardless.
			 *
			 * First run through, we set the content of the iframe to "javascript: false;".
			 * This of course triggers the onChange event, which runs this method again.
			 *
			 * Second time around, we unbind the 'load' listener (very important), and
			 * delete the iframe.
			 *
			 * Bit of a faff, but nothing too horrendous.
			 */

			// This is round 2.
			if (e.target.src.indexOf('javascript:') == 0) {
				$iframe.unbind('load');
				$iframe.remove();
				return;
			}
			
			log('amazonResponse IFRAME contents: ' + $iframe.contents().find('html').html());

			var $status		= $iframe.contents().find('#status');
			var $message	= $iframe.contents().find('#message');
			var $uploadId	= $iframe.contents().find('#uploadId');
			var $listItem	= $iframe.contents().find('#listItem');
			
			var status		= $status.length == 1 	? $status.text() 	: '';
			var message		= $message.length == 1 	? $message.text() 	: '';
			var uploadId	= $uploadId.length == 1 ? $uploadId.text() 	: '';
			var listItem	= $listItem.length== 1 	? $listItem.html() 	: '';

			var params = {
				listItem	: listItem,
				message		: message,
				status		: status,
				uploadId	: uploadId
			}

			// Do we have the expected information?
			if (status == '' || message == '' || uploadId == '') {

				/**
				 * We assume the worst. A blank message is passed, so we don't
				 * have to hard-code the language string here.
				 */

				params['listItem']	= '';
				params['message']	= '';
				params['status']	= 'failure';

				localOptions.onUploadFailure(params);

			} else {

				// Summon the handlers.
				(status == 'success')
					? localOptions.onUploadSuccess(params)
					: localOptions.onUploadFailure(params);
				
				/**
				 * Do we have a list item, and a branch? Some uploaded files will
				 * be duplicates. At the moment we just ignore those, although a
				 * visual indication that the file has been 'replaced' would be
				 * nice.
				 */
				
				if (uploads[uploadId] != 'undefined' && listItem != '') {
					
					// Get the branch root.
					var $branchRoot = uploads[uploadId];
					
					// Create the (orphan) list item.
					var $listItem = $(listItem).hide();
					
					// What is the list item's file name?
					var listItemFileName = $listItem.find('a').text().toLowerCase();
					
					/**
					 * Determine the point at which to insert the new item (alphabetically).
					 * Admitted defeat after trying to achieve this with $.map. May return
					 * to it, due to unhealthy stubborness.
					 */
					
					// Does the branch have any files at all?
					if ($branchRoot.children('.file').length == 0) {
						$listItem.appendTo($branchRoot);
						
					} else {
						
						var $successor = false;
						
						$branchRoot.find('> .file a').each(function(index) {
							if ($(this).text().toLowerCase() > listItemFileName) {
								$successor = $(this);
								return false;		// Stop the loop.
							}
						});

						if ($successor != false) {
							$listItem.insertBefore($successor);
						} else {
							$listItem.appendTo($branchRoot);
						}
					}
					
					// Insert the item, and animate its arrival.
					$listItem.slideDown(350);
				}
				
				/**
				 * Even if no list item was passed, still delete the upload item,
				 * if it exists.
				 */
				
				if (uploads[uploadId] != 'undefined')
				{
					delete uploads[uploadId];
				}
			}
			
			/**
			 * Originally we were setting this to "javascript: '<html></html>';"
			 * but that crashes Safari when the Web Inspector is open. Seriously.
			 */

			e.target.src = "javascript: false;";
			
		}; /* amazonResponse */


		/**
		 * Handles the file 'change' event. This is where the rubber hits the road.
		 *
		 * @access	private
		 * @param	object		e		The jQuery event object.
		 * @return 	void
		 */
		function fileChange(e) {

			var $file = $(e.target);
			var $parent = $file.parent('.bucketload');
			
			// Create the form.
			var formDecl = '<form accept-charset="utf-8" action="' + localOptions.uploadFormAction;
			formDecl += '" enctype="multipart/form-data" method="post"></form>';
			
			var $form = $(formDecl);

			// Create a unique ID for this upload.
			var uploadId = Math.round(Math.random() * new Date().getTime());
			
			// Retrieve the bucket and path.
			var path = $parent.find('input[name="path"]').val();

			// Create the form fields.
			$form.append('<input type="hidden" name="path" value="' + path + '">');
			$form.append('<input type="hidden" name="upload_id" value="' + uploadId + '">');

			/**
			 * Remove the file field listener. Incredibly important.
			 *
			 * jQuery doesn't remove the event handler automatically, and on document
			 * unload attempts to unbind an event on an object that no longer exists,
			 * in an iframe that no longer exists.
			 *
			 * IE then throws all lots of 'the bad man is fiddling with me' permission
			 * errors.
			 */

			$file.unbind('change');

			// Append the file field to the new form.
			$form.append($file);

			// Create and hide the iframe.
			var iframeId = 'bucketload-iframe-' + uploadId;
			var $iframe = $('<iframe id="' + iframeId + '" name="' + iframeId + '"></iframe>')
				.appendTo('body')
				.hide();
				
			// Wait a moment for the iframe to be added to the document.
			setTimeout(function() {
				// Populate the iframe.
				$iframe.contents().find('body').html($form);
				
				log('Created the IFRAME: ' + $iframe.contents().find('html').html());
				
				// Submit the form.
				$iframe.contents().find('form').submit();
				
				// Add a callback handler to the iframe.
				$iframe.bind('load', amazonResponse);
				
				// Make a note of the uploadId, and its location.
				uploads[uploadId] = $parent.closest('ul.bucketlist-tree');
				
				// Create a new file field.
				createFile($parent);

				// Call the onStart handler.
				localOptions.onUploadStart({fileName : $file.val(), uploadId : uploadId});

			}, 1);

			return false;

		}; /* fileChange */
		
		
		/**
		 * Creates the input file element.
		 *
		 * @access	private
		 * @param 	object		$parent		A jQuery object.
		 * @return 	void
		 */
		function createFile($parent) {
			$('<input name="file" type="file">')
				.appendTo($parent)
				.bind('change', fileChange);
				
		}; /* createFile */
		
		
		
		/**
		 * ----------------------------------------------------------
		 * FILE TREE FUNCTIONS
		 * ----------------------------------------------------------
		 */
		
		/**
		 * Initialises the file tree.
		 *
		 * @access	private
		 */
		function initializeTree() {
			// Bind the click event to all current and future bucketlist links.
			$('li a', $this).live('click', function(e) {
				treeClick($(e.target));
				return false;
			});

			// Load the buckets.
			showTree({
				$root	: $this,
				path	: ''
			});
			
		}; /* initializeTree */
		
		
		/**
		 * Loads a directory's sub-tree, or calls the callback handler when an
		 * item in the file tree is clicked.
		 *
		 * @access	private
		 * @param	jQuery object	$target		The click target.
		 */
		function treeClick($target) {
			
			if ($target.parent().hasClass('directory')) {

				if ($target.parent().hasClass('collapsed')) {

					/**
					 * Expand the tree. Only one branch of the tree can be
					 * open at any one time.
					 */

					$target.parent().parent().find('ul').slideUp({duration : 500});
					$target.parent().parent().find('.directory').removeClass('expanded').addClass('collapsed');
					$target.parent().find('ul').remove();
					
					showTree({
						$root 	: $target.parent(),
						path	: $target.eq(0).attr('rel')
					});

					$target.parent().removeClass('collapsed').addClass('expanded');

				} else {
					// Collapse the tree.
					$target.parent().find('ul').slideUp({duration : 500});
					$target.parent().removeClass('expanded').addClass('collapsed');

				}

			} else {
				localOptions.onFileClick({$target : $target, fileName : $target.attr('rel')});
			}
			
		}; /* treeClick */


		/**
		 * Expand the tree when a 'directory' element is clicked.
		 *
		 * @access	private
		 * @param	params		object		Switched to an associative array, because it's
		 *									much easier when debugging the calling script.
		 * 									- $root	: jQuery object containing branch root.
		 *									- path	: file path string, including bucket.
		 */
		function showTree(params) {
			
			var localParams = $.extend({
				$root	: false,
				path	: ''
			}, params);
			
			if (localParams.$root == false) {
				return false;
			}
			
			/**
			 * We're retrieving information from the rel attribute of the
			 * parent LI.
			 *
			 * This is *always* encoded on the server, using rawurlencode,
			 * to prevent problems with single and double quotes, angled
			 * brackets, and so forth.
			 *
			 * The showTree method is the only point at which we want this
			 * string in it's unencoded form, because it makes it easier
			 * to process.
			 *
			 * showTree must NEVER write the unencoded string back to
			 * the DOM, or pass it outside of this method.
			 *
			 * Are we clear on that?
			 */
			
			// Shortcuts.
			var $li		= localParams.$root;
			var path	= decodeURIComponent(localParams.path);
			
			// Hold up, butt.
			$li.addClass('wait');

			// Load the bucket contents via AJAX.
			$.get(
				localOptions.ajaxScriptURL,
				{dir: path},
				function(htmlFragment) {
					
					// Remove the initial "loading" message.
					if (initialLoad == true) {
						$('.initial-load', $this).fadeOut(function() {
							$(this).remove();
						});
						
						initialLoad = false;
					}
					
					// Remove the loading animation.
					$li.find('start').html('');
					$li.removeClass('wait').append(htmlFragment);
					
					// If the path is empty, we're loading the root 'buckets'.
					if (path == '') {
						$li.find('ul:hidden').show();
					} else {
						$li.find('ul:hidden').slideDown({duration : 500});
						
						/**
						 * Remember to pass the UNESCAPED path out of the method.
						 */
						
						initializeUpload($li, localParams.path);
						
						// Execute the callback.
						localOptions.onBranchLoad({$root : $li, path : localParams.path});
					}
					
					// Are we auto-displaying an initial file?
					if ($.isArray(initialFilePath)
						&& initialFilePath
						&& initialFileStep < initialFilePath.length) {
							
						pathToLoad = '';
						
						// Construct the complete path up to this point.
						for (var count = 0; count <= initialFileStep; count++) {
							pathToLoad += initialFilePath[count] + slash;
						}
						
						// If this is the final step, remove the forward slash.
						if (initialFileStep == initialFilePath.length - 1) {
							pathToLoad = pathToLoad.substring(0, pathToLoad.length - slash.length);
						}
						
						treeClick($li.parents('.eepro-co-uk').find('[rel="' + pathToLoad + '"]'));
						initialFileStep++;
					}
				}); /* $.get */
				
		}; /* showTree */
		
		
		// Starts the ball rolling.
		initializeTree();
		
		
	}); // this.each
}; // bucketlist


/**
 * Log a message to the JS console.
 *
 * @access	private
 * @param 	string		message		The text to log.
 */
function log(message) {
	if (window.console && window.console.log) {
		window.console.log(message);
	}
};


/**
 * Plugin defaults.
 */
$.fn.bucketlist.defaults = {
	ajaxScriptURL	: '',
	initialFile		: '',
	languageStrings	: {},
	onBranchLoad	: function(params) {},
	onFileClick		: function(params) {},
	onUploadFailure	: function(params) {},
	onUploadStart	: function(params) {},
	onUploadSuccess	: function(params) {},
	uploadFormAction : ''
};
	
})(jQuery);