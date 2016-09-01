(function ($) {
  Drupal.behaviors.foresight = {
    attach: function(context, settings) {
      foresight.reload();
    }
  }
}(jQuery));
;
/*
 * Foresight.js 2.0.0 Copyright (c) 2012, Adam Bradley
 * Available via the MIT license.
 * For details see: https://github.com/adamdbradley/foresight.js
 */

; ( function ( foresight, window, document, navigator ) {
	"use strict";

	foresight.images = []; 
	foresight.options = foresight.options || {};

	// options
	var opts = foresight.options,
	testConn = opts.testConn || true,
	minKbpsForHighBandwidth = opts.minKbpsForHighBandwidth || 300,
	speedTestUri = opts.speedTestUri || 'http://foresightjs.appspot.com/speed-test/50K',
	speedTestKB = opts.speedTestKB || 50,
	speedTestExpireMinutes = opts.speedTestExpireMinutes || 30,
	hiResClassname =  opts.hiResClassname || 'fs-high-resolution',
	lowResClassname = opts.lowResClassname || 'fs-standard-resolution',

	// using property string references for minification purposes
	DEVICE_PIXEL_RATIO = 'devicePixelRatio',
	DEVICE_PIXEL_RATIO_ROUNDED = 'devicePixelRatioRounded',
	BANDWIDTH = 'bandwidth',
	CONNECTION_TYPE = 'connType',
	CONNECTION_TEST_RESULT = 'connTestResult',
	CONNECTION_KBPS = 'connKbps',
	REQUEST_CHANGE = 'requestChange',
	DEFAULT_SRC = 'defaultSrc',
	HIGH_RES_SRC = 'highResolutionSrc',
	BROWSER_WIDTH = 'browserWidth',
	BROWSER_HEIGHT = 'browserHeight',
	REQUEST_WIDTH = 'requestWidth',
	REQUEST_HEIGHT = 'requestHeight',
	DIMENSION_WIDTH = 'width',
	DIMENSION_HEIGHT = 'height',
	WIDTH_UNITS = 'widthUnits',
	HEIGHT_UNITS = 'heightUnits',
	ASPECT_RATIO = 'aspectRatio',
	APPLIED_IMAGE_SET_ITEM = 'appliedImageSetItem',
	SCALE = 'scale',
	SCALE_ROUNDED = 'scaleRounded',
	URI_TEMPLATE = 'uriTemplate',
	URI_FIND = 'uriFind',
	URI_REPLACE = 'uriReplace',
	SRC_MODIFICATION = 'srcModification',
	STATUS_LOADING = 'loading',
	STATUS_COMPLETE = 'complete',
	LOCAL_STORAGE_KEY = 'fsjs',
	ASPECT_RATIO_AUTO = 'auto',
	UNIT_TYPE_PERCENT = 'percent',
	UNIT_TYPE_AUTO = 'auto',
	UNIT_TYPE_PIXEL = 'pixel',
	STYLE_ATTRIBUTE_DISPLAY = 'display',
	STYLE_VALUE_AUTO = 'auto',
	TRUE = true,
	FALSE = false,
	imageSetItemRegex = /url\((?:([a-zA-Z-_0-9{}\?=&\\/.:\s]+)|([a-zA-Z-_0-9{}\?=&\\/.:\s]+)\|([a-zA-Z-_0-9{}\?=&\\/.:\s]+))\)/g,
	STRIP_UNITS_REGEX =	/[^\d]+/,

	// used to keep track of the progress status for finding foresight 
	// images in the DOM and connection test results
	imageIterateStatus,
	speedConnectionStatus,

	initForesight = function () {
		// begin finding valid foresight <img>'s and updating their src's
		if ( imageIterateStatus ) return;

		imageIterateStatus = STATUS_LOADING;

		initImages();
		imageIterateStatus = STATUS_COMPLETE;

		initImageRebuild();
	},
	
	triggerImageEvent = function(eventName, img){
		if(document.createEvent){
			var event = document.createEvent( 'Event' );
			event.initEvent( 'foresight-' + eventName , TRUE, TRUE );
			img.dispatchEvent( event );
		} 
	},

	initImages = function () {
		// loop through each of the document.images and find valid foresight images
		var
		x,
		img,
		customCss;

		for ( x = 0; x < document.images.length; x ++ ) {
			img = document.images[ x ];

			// if we've already said to ignore this img then don't bother doing any more
			if ( img.ignore ) continue;

			// initialize properties the image will use
			// only gather the images that haven't already been initialized
			if ( !img.initalized ) {
				img.initalized = TRUE;
				
				triggerImageEvent( 'imageInitStart', img );
	
				img[ DEFAULT_SRC ] = getDataAttribute( img, 'src' );  // important, do not set the src attribute yet!
	
				// always set the img's data-width & data-height attributes so we always know its aspect ratio
				img[ WIDTH_UNITS ] = getDataAttribute( img, DIMENSION_WIDTH, TRUE );
				img[ HEIGHT_UNITS ] = getDataAttribute( img, DIMENSION_HEIGHT, TRUE );
				
				// if the aspect ratio was set then let's use that
				var tmpAspectRatio = getDataAttribute( img, 'aspect-ratio', FALSE);
				img[ ASPECT_RATIO ] = tmpAspectRatio === ASPECT_RATIO_AUTO
					? tmpAspectRatio 
					: ( !isNaN( tmpAspectRatio ) && tmpAspectRatio !== null ? parseFloat( tmpAspectRatio) : 0 );
	
				 // missing required info
				if ( !img[ DEFAULT_SRC ] ) {
					img.ignore = TRUE;
					continue;
				}
	
				img[ HIGH_RES_SRC ] = getDataAttribute( img, 'high-resolution-src' );
				img.orgClassName = ( img.className ? img.className : '' );
	
				// handle any response errors which may happen with this image
				img.onerror = imgResponseError;
	
				triggerImageEvent( 'imageInitEnd', img );
	
				// add this image to the collection
				foresight.images.push( img );
			}
			
			// Conditional CSS
			// font-family will be the hacked CSS property which contains the image-set() CSS value
			// using font-family allows us to access values within CSS, which may change per media query
			// image-set(url(foo-lowres.png) 1x low-bandwidth, url(foo-highres.png) 2x high-bandwidth);
			// http://lists.w3.org/Archives/Public/www-style/2012Feb/1103.html
			// http://trac.webkit.org/changeset/111637
			img.imageSetText = getComputedStyleValue( img, 'font-family', 'fontFamily' )
			
			img.imageSet = [];

			if ( img.imageSetText.length > 1 ) {
				// parse apart the custom CSS image-set() text
				parseImageSet( img, img.imageSetText.split( 'image-set(' )[ 1 ] );
			}
		}
	},

	// Added by Adrian Mayoral
	initImagesByContainer = function (theID) {
		if ( theID == '' || typeof theID == undefined ) return ;

		// loop through each of the document.getElementById(id) and find valid foresight images
		var
		x,
		img,
		customCss;

		var target = document.getElementById(theID);
		var images = target.getElementsByTagName("img");
		for( x = 0; x < images.length; x ++ ){
			img = images[x];
			
			// if we've already said to ignore this img then don't bother doing any more
			if ( img.ignore ) continue;

			// Render ALL images in that ID
			img.initalized = TRUE;
			
			triggerImageEvent( 'imageInitStart', img );
			
			img[ DEFAULT_SRC ] = getDataAttribute( img, 'src' );  // important, do not set the src attribute yet!
			
			// always set the img's data-width & data-height attributes so we always know its aspect ratio
			img[ WIDTH_UNITS ] = getDataAttribute( img, DIMENSION_WIDTH, TRUE );
			img[ HEIGHT_UNITS ] = getDataAttribute( img, DIMENSION_HEIGHT, TRUE );
			
			// if the aspect ratio was set then let's use that
			var tmpAspectRatio = getDataAttribute( img, 'aspect-ratio', FALSE);
			img[ ASPECT_RATIO ] = tmpAspectRatio === ASPECT_RATIO_AUTO
				? tmpAspectRatio 
				: ( !isNaN( tmpAspectRatio ) && tmpAspectRatio !== null ? parseFloat( tmpAspectRatio) : 0 );
			
			 // missing required info
			if ( !img[ DEFAULT_SRC ] ) {
				img.ignore = TRUE;
				continue;
			}
			img[ HIGH_RES_SRC ] = getDataAttribute( img, 'high-resolution-src' );
			img.orgClassName = ( img.className ? img.className : '' );
			
			// handle any response errors which may happen with this image
			img.onerror = imgResponseError;
			
			triggerImageEvent( 'imageInitEnd', img );
			
			// add this image to the collection
			foresight.images.push( img );



			
			// Conditional CSS
			// font-family will be the hacked CSS property which contains the image-set() CSS value
			// using font-family allows us to access values within CSS, which may change per media query
			// image-set(url(foo-lowres.png) 1x low-bandwidth, url(foo-highres.png) 2x high-bandwidth);
			// http://lists.w3.org/Archives/Public/www-style/2012Feb/1103.html
			// http://trac.webkit.org/changeset/111637
			img.imageSetText = getComputedStyleValue( img, 'font-family', 'fontFamily' )
			
			img.imageSet = [];

			if ( img.imageSetText.length > 1 ) {
				// parse apart the custom CSS image-set() text
				parseImageSet( img, img.imageSetText.split( 'image-set(' )[ 1 ] );
			}
			

		}

	},

	parseImageSet = function ( img, imageSetText ) {
		// parse apart the custom CSS image-set() text
		// add each image-set item to the img.imageSet array
		// the array will be used later when deciding what image to request
		var
		y,
		imageSetValues = imageSetText !== undefined  && imageSetText !== null ? imageSetText.split( ',' ) : [],
		imageSetItem,
		urlMatch;

		for ( y = 0; y < imageSetValues.length; y ++ ) {

			// set the defaults for this image-set item
			// scaleFactor and bandwidth initially are set to the device's info
			// the more specific an image-set item is then the more weight
			// it will receive so we can decide later which one to apply to the image
			imageSetItem = {
				text: imageSetValues[ y ],
				weight: 0
			};

			// get the image's scale factor if it was provided
			if ( imageSetItem.text.indexOf( ' 1.5x' ) > -1 ) {
				imageSetItem.weight++; // gets more weight if its looking for an exact pixel ratio
				imageSetItem[ SCALE ] = 1.5;
			} else if ( imageSetItem.text.indexOf( ' 2x' ) > -1 ) {
				imageSetItem[ SCALE ] = 2;
			} else if ( imageSetItem.text.indexOf( ' 1x' ) > -1 ) {
				imageSetItem[ SCALE ] = 1;
			}

			// get the image's bandwidth value if it was provided
			if ( imageSetItem.text.indexOf( ' high-bandwidth' ) > -1 ) {
				imageSetItem[ BANDWIDTH ] = 'high';
			} else if ( imageSetItem.text.indexOf( ' low-bandwidth' ) > -1 ) {
				imageSetItem[ BANDWIDTH ] = 'low';
			}

			// get the values pulled out of the image-set with a regex
			while ( urlMatch = imageSetItemRegex.exec( imageSetItem.text ) ) {
				if ( urlMatch[ 1 ] != null && urlMatch[ 1 ] !== '' ) {
					// url(URI_TEMPLATE)
					imageSetItem[ URI_TEMPLATE ] = urlMatch[ 1 ];
					imageSetItem.weight++;
				} else if ( urlMatch[ 2 ] != null && urlMatch[ 2 ] !== '' ) {
					// url-replace(URI_FIND|URI_REPLACE)
					imageSetItem[ URI_FIND ] = urlMatch[ 2 ];
					imageSetItem[ URI_REPLACE ] = urlMatch[ 3 ];
					imageSetItem.weight++;
				}
			}

			// give more weight to item-set items that have BOTH scale and bandwidth
			// give 1 more weight if they have EITHER a scale or bandwidth
			if( imageSetItem[ SCALE ] && imageSetItem[ BANDWIDTH ] ) {
				imageSetItem.weight += 2;
			} else if( imageSetItem[ SCALE ] || imageSetItem[ BANDWIDTH ] ) {
				imageSetItem.weight++;
			}

			// each img keeps an array containing each of its image-set items
			// this array is used later when foresight decides which image to request
			img.imageSet.push( imageSetItem );
		}

		// now that we have an array of imageSet items, sort them so the 
		// image-set items with the most weight are first in the array's order
		// this is used later when deciding which image-set item to apply
		img.imageSet.sort( compareImageSets );
	},

	compareImageSets = function ( a, b ) {
		// image set items with a higher weight will sort at the beginning of the array
		if (a.weight < b.weight)
			return 1;
		if (a.weight > b.weight)
			return -1;
		return 0;
	},

	getDataAttribute = function ( img, attribute, getInt, value ) {
		// get an <img> element's data- attribute value
		value = img.getAttribute( 'data-' + attribute );
		if ( getInt  && value!==null) {
			if ( !isNaN( value ) ) {
				return parseInt( value, 10 );
			}
			return 0;
		}
		return value;
	},

	initImageRebuild = function () {
		// if we've completed both the connection speed test and we've found
		// all of the valid foresight images then rebuild each image's src
		if ( !( speedConnectionStatus === STATUS_COMPLETE && imageIterateStatus === STATUS_COMPLETE ) ) return;

		// variables reused throughout the for loop
		var
		x,
		imagesLength = foresight.images.length,
		img,
		dimensionIncreased,
		classNames,
		dimensionClassName,
		dimensionCssRules = [],
		computedWidthValue;

		for ( x = 0; x < imagesLength; x++ ) {
			img = foresight.images[ x ];

			if ( !isParentVisible( img ) ) {
				// parent element is not visible (yet anyways) so don't continue with this img
				continue;
			}

			triggerImageEvent( 'imageRebuildStart', img );

			// build a list of CSS Classnames for the <img> which may be useful
			classNames = img.orgClassName.split( ' ' );

			// get the computed pixel width according to the browser
			fillComputedPixelDimensions( img );
			if ( img.unitType == UNIT_TYPE_PIXEL ) {
				// instead of manually assigning width, then height, for every image and doing many repaints
				// create a classname from its dimensions and when we're all done
				// we can then add those CSS dimension classnames to the document and do less repaints
				dimensionClassName = 'fs-' + img[ BROWSER_WIDTH ] + 'x' + img[ BROWSER_HEIGHT ];
				classNames.push( dimensionClassName );

				if ( dimensionCssRules[ dimensionClassName ] == undefined ){
					// build a list of CSS rules for all the different dimensions
					// ie:  .fs-640x480{width:640px;height:480px}
					// ensure no duplicates are added to the CSS rules array
					dimensionCssRules[ dimensionClassName ] = TRUE;
					dimensionCssRules.push( '.' + dimensionClassName + '{width:' + ( (img[ BROWSER_WIDTH ]>0) ? (img[ BROWSER_WIDTH ] + 'px;') : 'inherit;' ) + ' height:' + ( (img[ BROWSER_HEIGHT ]>0) ? (img[ BROWSER_HEIGHT ] + 'px;') : 'auto;' ) + '}' ); 
				}
			}

			// show the display to inline so it flows in the webpage like a normal img
			if ( img.style.display !== 'inline' ) {
				img.style.display = 'inline';
			}

			// loop through each of the imaget-set items and 
			// assign which one to apply to the image src
			assignImageSetItem( img );

			setRequestDimensions( img );

			// add a CSS classname if this img is hi-res or not
			if ( foresight.hiResEnabled && img.src !== img[ DEFAULT_SRC ] ) {
				classNames.push( hiResClassname );
			} else {
				classNames.push( lowResClassname );
			}
			classNames.push( 'fs-' + img[ SRC_MODIFICATION ] );

			// assign the new CSS classnames to the img
			img.className = classNames.join( ' ' );

			triggerImageEvent( 'imageRebuildEnd', img );
		}

		// if there were are imgs that need width/height assigned to them then
		// add their CSS rules to the document
		if ( dimensionCssRules.length ) {
			applyDimensionCssRules( dimensionCssRules );
		}

		if ( foresight.updateComplete ) {
			// fire off the updateComplete() function if one exists
			foresight.updateComplete();
		}

		// remember what the window width is to evaluate later when the window resizes
		lastWindowWidth = getWindowWidth();
	},
	
	setRequestDimensions = function ( img ) {
		// decide if this image should be hi-res or not
		// both the scale factor should be greater than 1 and the bandwidth should be 'high'
		var
		imgRequestWidth,
		imgRequestHeight;
		
		if ( img[ APPLIED_IMAGE_SET_ITEM ][ SCALE ] > 1 && img[ APPLIED_IMAGE_SET_ITEM ][ BANDWIDTH ] === 'high' ) {
			// hi-res is good to go, figure out our request dimensions
			imgRequestWidth = img[ BROWSER_WIDTH ] === undefined ? STYLE_VALUE_AUTO : Math.round( img[ BROWSER_WIDTH ] * img[ APPLIED_IMAGE_SET_ITEM ][ SCALE ] );
			imgRequestHeight = img[ BROWSER_HEIGHT ] === undefined ? STYLE_VALUE_AUTO : Math.round( img[ BROWSER_HEIGHT ] * img[ APPLIED_IMAGE_SET_ITEM ][ SCALE ] );
			foresight.hiResEnabled = TRUE;
		} else {
			// no-go on the hi-res, go with the default size
			imgRequestWidth = img[ BROWSER_WIDTH ] === undefined ? STYLE_VALUE_AUTO : img[ BROWSER_WIDTH ];
			imgRequestHeight = img[ BROWSER_HEIGHT ] === undefined ? STYLE_VALUE_AUTO : img[ BROWSER_HEIGHT ];
			foresight.hiResEnabled = FALSE;
		}

		// only update the request width/height when the new dimension is 
		// larger than the one already loaded (this will always be needed on first load)
		// if the new request size is smaller than the image already loaded then there's 
		// no need to request another image, just let the browser shrink the current img
		// or if the file has changed due to conditional CSS (media query changed which image-set to use)
		if ( !img[ REQUEST_WIDTH ] || imgRequestWidth > img[ REQUEST_WIDTH ] || img.activeImageSetText !== img.imageSetText ) {
			 	
			img[ REQUEST_WIDTH ] = imgRequestWidth;
			img[ REQUEST_HEIGHT ] = imgRequestHeight;

			// decide how the img src should be modified for the image request
			if ( img[ HIGH_RES_SRC ] && foresight.hiResEnabled ) {
				// this image has a hi-res src manually set and the device is hi-res enabled
				// set the img src using the data-high-resolution-src attribute value
				// begin the request for this image
				img.src = img[ HIGH_RES_SRC ];
				img[ SRC_MODIFICATION ] = 'src-hi-res';
			} else {
				img.src = setSrc( img );
			}
			img[ REQUEST_CHANGE ] = TRUE;
			
			// remember which image-set we used to apply this image
			// this is useful if the window changes width and a media query applies another image-set
			img.activeImageSetText = img.imageSetText;
		} else {
			img[ REQUEST_CHANGE ] = FALSE;
		}
	},

	setSrc = function ( img ) {
		// decide how the img src should be modified for the image request
		if ( img[ APPLIED_IMAGE_SET_ITEM ][ URI_TEMPLATE ] ) {
			// this image's src should be parsed a part then
			// rebuilt using the supplied URI template
			// this allows you to place the dimensions where ever in the src
			img[ SRC_MODIFICATION ] = 'src-uri-template';
			return rebuildSrcFromUriTemplate( img );
		} else if ( img[ APPLIED_IMAGE_SET_ITEM ][ URI_FIND ] && img[ APPLIED_IMAGE_SET_ITEM ][ URI_REPLACE ] ) {
			// this should find a certain values in the image's src 
			// then replace the values with values given
			img[ SRC_MODIFICATION ] = 'src-find-replace';
			return replaceUriValues( img );
		}
		// make no changes from the default src
		img[ SRC_MODIFICATION ] = 'src-default';
		return img[ DEFAULT_SRC ];
	},

	assignImageSetItem = function ( img ) {
		// loop through each of the imaget-set items and assign which one to apply to the image
		// imageSet array is already ordered so the most specific and highest weighted
		// image-set item is on top. Yes its a crazy 'if' statement but being that
		// our importances is already set, first one to match the criteria wins
		// use the scale factor and bandwidth value to determine which image-set item to apply to the img src

		// create a default object to for the appliedImageSetItem
		var
		y,
		imageSetItem,
		appliedImageSetItem = {};

		// Here's a run down of what's happening in this loop:
		// 1) See if the exact pixel ratio and scale factor match, and bandwidth matches 
		// 2) See if the rounded pixel ratio and scale factor match, and bandwidth matches 
		// 3) See if the exact pixel ratio and scale factor match
		// 4) See if the rounded pixel ratio and scale factor match
		// 5) See if the bandwidth matches
		for ( y = 0; y < img.imageSet.length; y++ ) {
			imageSetItem = img.imageSet[ y ];
			if ( imageSetItem[ SCALE ] && imageSetItem[ BANDWIDTH ] ) {
				// this image-set item has both the scale and bandwidth arguments
				if ( foresight[ DEVICE_PIXEL_RATIO ] == imageSetItem[ SCALE ] && foresight[ BANDWIDTH ] === imageSetItem[ BANDWIDTH ] ) {
					// this device's exact pixel ratio matches the image-set item's scale factor
					// and this device's bandwidth matches the image-set item's bandwidth
					appliedImageSetItem = imageSetItem;
					break;
				} else if ( Math.round( foresight[ DEVICE_PIXEL_RATIO ] ) == imageSetItem[ SCALE ] && foresight[ BANDWIDTH ] === imageSetItem[ BANDWIDTH ] ) {
					// this device's rounded pixel ratio matches the image-set item's scale factor
					// and this device's bandwidth matches the image-set item's bandwidth
					appliedImageSetItem = imageSetItem;
					break;
				}
			} else if ( imageSetItem[ SCALE ] ) {
				// this image-set item has only the scale argument
				if ( foresight[ DEVICE_PIXEL_RATIO ] == imageSetItem[ SCALE ] ) {
					// this device's exact pixel ratio matches this image-set item's scale factor
					appliedImageSetItem = imageSetItem;
					break;
				} else if ( Math.round( foresight[ DEVICE_PIXEL_RATIO ] ) == imageSetItem[ SCALE ] ) {
					// this device's rounded pixel ratio matches this image-set item's scale factor
					appliedImageSetItem = imageSetItem;
					break;
				}
			} else if ( imageSetItem[ BANDWIDTH ] ) {
				// this image-set item has only the bandwidth argument
				if ( foresight[ BANDWIDTH ] === imageSetItem[ BANDWIDTH ] ) {
					// this device's bandwidth matches the image-set item's bandwidth
					appliedImageSetItem = imageSetItem;
					break;
				}
			} else {
				// this image-set item did not have any arguments
				// this must be the last resort
				appliedImageSetItem = imageSetItem;
			}
		}

		// ensure we have all the values we need so we can apply an image-set item
		// many missing values not present in the aplied image-set item should come from device info
		if ( !appliedImageSetItem[ SCALE ] ) {
			// we never got a scale factor, use device pixel ratio as the default
			appliedImageSetItem[ SCALE ] = foresight[ DEVICE_PIXEL_RATIO ];
		}
		if ( !appliedImageSetItem[ BANDWIDTH ] ) {
			// we never got a bandwidth value, use device bandwidth as the default
			appliedImageSetItem[ BANDWIDTH ] = foresight[ BANDWIDTH ];
		}

		// round the exact scale factor to the scale rounded property
		// this would set a scale factor of 1.5 to 2
		appliedImageSetItem[ SCALE_ROUNDED ] = Math.round( appliedImageSetItem[ SCALE ] );

		img[ APPLIED_IMAGE_SET_ITEM ] = appliedImageSetItem;
	},
	
	isParentVisible = function ( ele, parent ) {
		// test to see if this element's parent is currently visible in the DOM
		parent = ele.parentNode;
        if (parent == null) {
            return FALSE;
        }
		if ( parent.clientWidth ) {
			return TRUE;
		}
		if ( getComputedStyleValue( parent, 'display' ) === 'inline' ) {
			// if its parent is an inline element then we won't get a good clientWidth
			// so try again with this element's parent
			return isParentVisible( parent );
		}
		return FALSE;
	},

	fillComputedPixelDimensions = function ( img, computedWidthValue ) {
		// get the computed pixel width according to the browser
		// this is most important for images set by percents
		// and images with a max-width set
		if ( !img.unitType ) {
			//Get computed style value but to get valid width we need to have the display set to none
			var oldDisplay = img.style[ STYLE_ATTRIBUTE_DISPLAY ];
			img.style[ STYLE_ATTRIBUTE_DISPLAY ] = 'none';
			computedWidthValue = getComputedStyleValue( img, DIMENSION_WIDTH );
			img.style[ STYLE_ATTRIBUTE_DISPLAY ] = oldDisplay;

			if ( ( img[ ASPECT_RATIO] && computedWidthValue === 'auto' ) || computedWidthValue.indexOf( '%' ) > 0 ) {
				// if the width has a percent value then change the display to
				// display:block to help get correct browser pixel width
				img.unitType = UNIT_TYPE_PERCENT;
			} else {
				// the browser already knows the exact pixel width
				// assign the browser pixels to equal the width and height units
				// this only needs to happen the first time
				img.unitType = UNIT_TYPE_PIXEL;
				// If the aspect ratio is set then we will get the other value off the
				// aspect ratio
				if( img[ ASPECT_RATIO ] && img[ ASPECT_RATIO ] !== ASPECT_RATIO_AUTO ) {
					if( img[ HEIGHT_UNITS ] ){						
						img[ BROWSER_WIDTH ] = Math.round( img[ HEIGHT_UNTIS ] / img[ ASPECT_RATIO ] );
						img[ BROWSER_HEIGHT ] = img[ HEIGHT_UNITS ];
					} else {
						img[ BROWSER_WIDTH ] = img[ WIDTH_UNITS ] || computedWidthValue.replace(STRIP_UNITS_REGEX, "");
						img[ BROWSER_HEIGHT ] =  Math.round( img[ BROWSER_WIDTH ] / img[ ASPECT_RATIO ] );
					}
				} else {
					img[ BROWSER_WIDTH ] = img[ WIDTH_UNITS ];
					img[ BROWSER_HEIGHT ] = img[ HEIGHT_UNITS ];
				}
			}
		}


		if ( img.unitType === UNIT_TYPE_PERCENT || img[ ASPECT_RATIO ] ) {
			// the computed width is probably getting controlled by some applied width property CSS
			// since we now know what the pixel width the browser wants it to be, calculate its height
			// the height should be calculated with the correct aspect ratio
			// this should be re-ran every time the window width changes
			img.computedWidth = getComputedPixelWidth( img );
			img[ BROWSER_WIDTH ] = img.computedWidth;
			

			if( img[ ASPECT_RATIO ] != ASPECT_RATIO_AUTO ){
				//if aspect ratio is auto then we will not set the height in the request off the width
				img[ BROWSER_HEIGHT ] = Math.round( img[ BROWSER_WIDTH ] / img[ ASPECT_RATIO ] );
			} else if(img[ HEIGHT_UNITS ]) {
				//If we set the height to fixed then use that for the request height
				img[ BROWSER_HEIGHT ] = Math.round( img[ HEIGHT_UNITS ] * ( img.computedWidth / img[ WIDTH_UNITS ] ) );
			}
			
			if( img[ BROWSER_HEIGHT ] && navigator.appVersion.indexOf( 'MSIE' ) > -1 ) {
				// manually assign what the calculated height pixels should be
				// do this only for our friend IE, the rest of the browsers can gracefully
				// resize of the image without manually setting the height in pixels
				img.style.height = img[ BROWSER_HEIGHT ] + 'px';
			}
			
			
		}
	},
	
	getComputedPixelWidth = function ( img ) {
		// code is a slimmed down version of jQuery getWidthOrHeight() and css swap()
		if ( img.offsetWidth !== 0 ) {
			return img.offsetWidth;
		} else {
			// doesn't have an offsetWidth yet, apply styles which adds display:block, but visibility hidden
			// remember what the inline values were before changing them, so you can change them back
			var ret, name,
				old = {},
				cssShow = { position: "absolute", visibility: "hidden", display: "block" };
			for ( name in cssShow ) {
				old[ name ] = img.style[ name ];
				img.style[ name ] = cssShow[ name ];
			}
			ret = img.offsetWidth;
			// change back the styles to what they were before we got the offsetWidth
			for ( name in cssShow ) {
				img.style[ name ] = old[ name ];
			}
			return ret;
		}
	},

	getComputedStyleValue = function ( element, cssProperty, jsReference ) {
		// get the computed style value for this element (but there's an IE way and the rest-of-the-world way)
		if ( !jsReference ) {
			jsReference = cssProperty;
		}
		return element.currentStyle ? element.currentStyle[ jsReference ] : document.defaultView.getComputedStyle( element, null ).getPropertyValue( cssProperty );
	},

	dimensionStyleEle,
	applyDimensionCssRules = function ( dimensionCssRules, cssRules ) {
		if ( !dimensionStyleEle ) {
			// build a new style element to hold all the dimension CSS rules
			// add the new style element to the head element
			dimensionStyleEle = document.createElement( 'style' );
			dimensionStyleEle.setAttribute( 'type', 'text/css' );
		}

		cssRules = dimensionCssRules.join( '' );

		// add all of the dimension CSS rules to the style element
		try {
			dimensionStyleEle.innerHTML = cssRules;
		} catch( e ) {
			// our trusty friend IE has their own way of doing things, weird I know
			dimensionStyleEle.styleSheet.cssText = cssRules;
		}

		if ( dimensionStyleEle.parentElement == null ) {
			// append it to the head element if we haven't done so yet
			document.getElementsByTagName( 'head' )[ 0 ].appendChild( dimensionStyleEle );
		}
	},

	rebuildSrcFromUriTemplate = function ( img ) {
		// rebuild the <img> src using the supplied URI template and image data
		var
		x,
		formatReplace = [ 'src', 'protocol', 'host', 'port', 'directory', 'file', 'filename', 'ext', 'query', REQUEST_WIDTH, REQUEST_HEIGHT, SCALE, SCALE_ROUNDED ],
		newSrc = img[ APPLIED_IMAGE_SET_ITEM ][ URI_TEMPLATE ];

		// parse apart the original src URI
		img.uri = parseUri( img[ DEFAULT_SRC ] );

		// add in a few more properties we'll need for the find/replace later
		img.uri.src = img[ DEFAULT_SRC ];
		img.uri[ REQUEST_WIDTH ] = img[ REQUEST_WIDTH ];
		img.uri[ REQUEST_HEIGHT ] = img[ REQUEST_HEIGHT ];
		img.uri[ SCALE ] = img[ APPLIED_IMAGE_SET_ITEM ][ SCALE ];
		img.uri[ SCALE_ROUNDED ] = img[ APPLIED_IMAGE_SET_ITEM ][ SCALE_ROUNDED ];

		// loop through all the possible format keys and 
		// replace them with their respective value for this image
		for ( x = 0; x < formatReplace.length; x++ ) {
			newSrc = newSrc.replace( '{' + formatReplace[ x ] + '}', img.uri[ formatReplace[ x ] ] );
		}

		// return the new src, begin the request for this image
		return newSrc; 
	},

	// parseUri 1.2.2
	// (c) Steven Levithan <stevenlevithan.com>
	// MIT License
	// Modified by Adam Bradley for foresight.js
	parseUri = function ( str ) {
		var o = {
			key: [ "source", "protocol", "authority", "userInfo", "user", "password", "host", "port", "relative", "path", "directory", "file", "query", "anchor" ],
			q: {
				name: "queryKey",
				parser: /(?:^|&)([^&=]*)=?([^&]*)/g
			},
			parser: /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
		},
		m = o.parser.exec( str ),
		uri = {},
		i = 14;

		while (i--) uri[o.key[i]] = m[i] || "";

		uri[o.q.name] = {};
		uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
			if ($1) uri[o.q.name][$1] = $2;
		});

		var fileSplt = uri.file.split('.');
		uri.filename = fileSplt[ 0 ];
		uri.ext = ( fileSplt.length > 1 ? fileSplt[ fileSplt.length - 1 ] : '' );

		return uri;
	},

	replaceUriValues = function ( img ) {
		// replace values already in the image src with values coming from the url-replace() CSS
		var
		findValue = img[ APPLIED_IMAGE_SET_ITEM ][ URI_FIND ]
							.replace( '{browserWidth}', img[ WIDTH_UNITS ] )
							.replace( '{browserHeight}', img[ HEIGHT_UNITS ] );

		var
		f,
		newSrc = img[ DEFAULT_SRC ].replace( findValue, img[ APPLIED_IMAGE_SET_ITEM ][ URI_REPLACE ] ),
		formatReplace = [ REQUEST_WIDTH, REQUEST_HEIGHT, SCALE, SCALE_ROUNDED ];

		img[ SCALE ] = img[ APPLIED_IMAGE_SET_ITEM ][ SCALE ];
		img[ SCALE_ROUNDED ] = img[ APPLIED_IMAGE_SET_ITEM ][ SCALE_ROUNDED ];

		// loop through all the possible format keys and 
		// replace them with their respective value for this image
		for ( f = 0; f < formatReplace.length; f++ ) {
			newSrc = newSrc.replace( '{' + formatReplace[ f ] + '}', img[ formatReplace[ f ] ] );
		}

		// return the new src, begin the request for this image
		return newSrc; 
	},

	imgResponseError = function ( img ) {
		img = this;
		img.className = img.className.replace( hiResClassname, lowResClassname );
		img[ SRC_MODIFICATION ] = 'response-error';
		if ( img.hasError || img.src === img[ DEFAULT_SRC ] ) return;
		img.hasError = TRUE;
		img.src = img[ DEFAULT_SRC ];
	},

	initSpeedTest = function () {
		// only check the connection speed once, if there is a status then we've
		// already got info or it already started
		if ( speedConnectionStatus ) return;

		// force that this device has a low or high bandwidth, used more so for debugging purposes
		if ( opts.forcedBandwidth ) {
			foresight[ BANDWIDTH ] = opts.forcedBandwidth;
			foresight[ CONNECTION_TEST_RESULT ] = 'forced';
			speedConnectionStatus = STATUS_COMPLETE;
			return;
		}

		// if the device pixel ratio is 1, then no need to do a network connection 
		// speed test since it can't show hi-res anyways
		if ( foresight[ DEVICE_PIXEL_RATIO ] === 1 ) {
			foresight[ CONNECTION_TEST_RESULT ] = 'skip';
			speedConnectionStatus = STATUS_COMPLETE;
			return;
		}

		// if we know the connection is 2g or 3g 
		// don't even bother with the speed test, cuz its slow
		// Network connection feature detection referenced from Modernizr
		// Modernizr v2.5.3, www.modernizr.com
		// Copyright (c) Faruk Ates, Paul Irish, Alex Sexton
		// Available under the BSD and MIT licenses: www.modernizr.com/license/
		// https://github.com/Modernizr/Modernizr/blob/master/feature-detects/network-connection.js 
		// Modified by Adam Bradley for Foresight.js
		var connection = navigator.connection || { type: 'unknown' }; // polyfill
		var isSlowConnection = connection.type == 3 // connection.CELL_2G 
							   || connection.type == 4 // connection.CELL_3G
							   || connection.bandwidth <= 0.125; // integer value in new spec (MB)
		foresight[ CONNECTION_TYPE ] = connection.type;
		if ( isSlowConnection ) {
			// we know this connection is slow, don't bother even doing a speed test
			foresight[ CONNECTION_TEST_RESULT ] = 'connTypeSlow';
			speedConnectionStatus = STATUS_COMPLETE;
			return;
		}

		// check if a speed test has recently been completed and its 
		// results are saved in the local storage
		try {
			var fsData = JSON.parse( localStorage.getItem( LOCAL_STORAGE_KEY ) );
			if ( fsData !== null ) {
				if ( ( new Date() ).getTime() < fsData.exp ) {
					// already have connection data within our desired timeframe
					// use this recent data instead of starting another test
					foresight[ BANDWIDTH ] = fsData.bw;
					foresight[ CONNECTION_KBPS ] = fsData.kbps;
					foresight[ CONNECTION_TEST_RESULT ] = 'localStorage';
					speedConnectionStatus = STATUS_COMPLETE;
					return;
				}
			}
		} catch( e ) { }

		var 
		speedTestImg = document.createElement( 'img' ),
		endTime,
		startTime,
		speedTestTimeoutMS;

		speedTestImg.onload = function () {
			// speed test image download completed
			// figure out how long it took and an estimated connection speed
			endTime = ( new Date() ).getTime();

			var duration = ( endTime - startTime ) / 1000;
			duration = ( duration > 1 ? duration : 1 ); // just to ensure we don't divide by 0

			foresight[ CONNECTION_KBPS ] = ( ( speedTestKB * 1024 * 8 ) / duration ) / 1024;
			foresight[ BANDWIDTH ] = ( foresight[ CONNECTION_KBPS ] >= minKbpsForHighBandwidth ? 'high' : 'low' );

			speedTestComplete( 'networkSuccess' );
		};

		speedTestImg.onerror = function () {
			// fallback incase there was an error downloading the speed test image
			speedTestComplete( 'networkError', 5 );
		};

		speedTestImg.onabort = function () {
			// fallback incase there was an abort during the speed test image
			speedTestComplete( 'networkAbort', 5 );
		};

		// begin the network connection speed test image download
		startTime = ( new Date() ).getTime();
		speedConnectionStatus = STATUS_LOADING;
		if ( document.location.protocol === 'https:' ) {
			// if this current document is SSL, make sure this speed test request
			// uses https so there are no ugly security warnings from the browser
			speedTestUri = speedTestUri.replace( 'http:', 'https:' );
		}
		speedTestImg.src = speedTestUri + "?r=" + Math.random();

		// calculate the maximum number of milliseconds it 'should' take to download an XX Kbps file
		// set a timeout so that if the speed test download takes too long
		// than it isn't a 'high-bandwidth' and ignore what the test image .onload has to say
		// this is used so we don't wait too long on a speed test response 
		// Adding 350ms to account for TCP slow start, quickAndDirty === TRUE
		speedTestTimeoutMS = ( ( ( speedTestKB * 8 ) / minKbpsForHighBandwidth ) * 1000 ) + 350;
		setTimeout( function () {
			speedTestComplete( 'networkSlow' );
		}, speedTestTimeoutMS );
	},

	speedTestComplete = function ( connTestResult, expireMinutes ) {
		// if we haven't already gotten a speed connection status then save the info
		if (speedConnectionStatus === STATUS_COMPLETE) return;

		// first one with an answer wins
		speedConnectionStatus = STATUS_COMPLETE;
		foresight[ CONNECTION_TEST_RESULT ] = connTestResult;

		try {
			if ( !expireMinutes ) {
				expireMinutes = speedTestExpireMinutes;
			}
			var fsDataToSet = {
				kbps: foresight[ CONNECTION_KBPS ],
				bw: foresight[ BANDWIDTH ],
				exp: ( new Date() ).getTime() + (expireMinutes * 60000)
			};
			localStorage.setItem( LOCAL_STORAGE_KEY, JSON.stringify( fsDataToSet ) );
		} catch( e ) { }

		initImageRebuild();
	},

	addWindowResizeEvent = function () {
		// attach the foresight.reload event that executes when the window resizes
		if ( window.addEventListener ) {
			window.addEventListener( 'resize', windowResized, FALSE );
		} else if ( window.attachEvent ) {
			window.attachEvent( 'onresize', windowResized );
		}
	},

	lastWindowWidth = 0,
	windowResized = function () {
		// only reload when the window changes the width
		// we don't care if the window's height changed
		if ( lastWindowWidth !== getWindowWidth() ) {
			foresight.reload();
		}
	},

	getWindowWidth = function () {
		return document.documentElement.clientWidth || document.body && document.body.clientWidth || 1024;
	},

	reloadTimeoutId,
	executeReload = function () {
		// execute the reload. This is initially governed by a 'setTimeout'
		// so the reload isn't abused with too many calls
		if ( imageIterateStatus !== STATUS_COMPLETE || speedConnectionStatus !== STATUS_COMPLETE ) return;
		initImages();
		initImageRebuild();
	};

	foresight.resolve = function ( imageSetValue, imageData ) {
		// public method so you can pass in an image-set value along with image data
		// then return the image data which now has the src property filled in
		imageData.imageSet = [];
		parseImageSet( imageData, imageSetValue );
		assignImageSetItem( imageData );
		setRequestDimensions( imageData )
		imageData.src = setSrc( imageData );
	};

	foresight.reload = function () {
		// public method available for if the DOM changes since the initial load (like a changepage in jQuery Mobile)
		// Uses a timeout so it can govern how many times the reload executes without goin nuts
		window.clearTimeout( reloadTimeoutId ); 
		reloadTimeoutId = window.setTimeout( executeReload, 250 ); 
	};

	// when the DOM is ready begin finding valid foresight <img>'s and updating their src's
	foresight.ready = function () {
		if ( !document.body ) {
			return window.setTimeout( foresight.ready, 1 );
		}
		initForesight();
	};

	// Added by Adrian Mayoral
	/**
		This function try to sync images from "X div (container)" loaded before DOM.
	*/
	foresight.async = function(theID){
		if ( theID == '' || typeof theID == undefined ) return ;
		imageIterateStatus = STATUS_LOADING;
		initImagesByContainer(theID);
		imageIterateStatus = STATUS_COMPLETE;
		initImageRebuild();
	};

	if ( document.readyState === STATUS_COMPLETE ) {
		setTimeout( foresight.ready, 1 );
	} else {
		if ( document.addEventListener ) {
			document.addEventListener( "DOMContentLoaded", foresight.ready, FALSE );
			window.addEventListener( "load", foresight.ready, FALSE );
		} else if ( document.attachEvent ) {
			document.attachEvent( "onreadystatechange", foresight.ready );
			window.attachEvent( "onload", foresight.ready );
		}
	}

	// get this device's pixel ratio
	foresight[ DEVICE_PIXEL_RATIO ] = window[ DEVICE_PIXEL_RATIO ] ? window[ DEVICE_PIXEL_RATIO ] : 1;

	if ( opts.forcedPixelRatio ) {
		// force a certain device pixel ratio, used more so for debugging purposes
		foresight[ DEVICE_PIXEL_RATIO ] = opts.forcedPixelRatio;
	}

	foresight[ DEVICE_PIXEL_RATIO_ROUNDED ] = Math.round( foresight[ DEVICE_PIXEL_RATIO ] );

	// DOM does not need to be ready to begin the network connection speed test
	initSpeedTest();

	// add a listener to the window.resize event
	addWindowResizeEvent();

} ( this.foresight = this.foresight || {}, this, document, navigator ) );;
(function ($) {

/**
 * Attaches the autocomplete behavior to all required fields.
 */
Drupal.behaviors.autocomplete = {
  attach: function (context, settings) {
    var acdb = [];
    $('input.autocomplete', context).once('autocomplete', function () {
      var uri = this.value;
      if (!acdb[uri]) {
        acdb[uri] = new Drupal.ACDB(uri);
      }
      var $input = $('#' + this.id.substr(0, this.id.length - 13))
        .attr('autocomplete', 'OFF')
        .attr('aria-autocomplete', 'list');
      $($input[0].form).submit(Drupal.autocompleteSubmit);
      $input.parent()
        .attr('role', 'application')
        .append($('<span class="element-invisible" aria-live="assertive"></span>')
          .attr('id', $input.attr('id') + '-autocomplete-aria-live')
        );
      new Drupal.jsAC($input, acdb[uri]);
    });
  }
};

/**
 * Prevents the form from submitting if the suggestions popup is open
 * and closes the suggestions popup when doing so.
 */
Drupal.autocompleteSubmit = function () {
  return $('#autocomplete').each(function () {
    this.owner.hidePopup();
  }).length == 0;
};

/**
 * An AutoComplete object.
 */
Drupal.jsAC = function ($input, db) {
  var ac = this;
  this.input = $input[0];
  this.ariaLive = $('#' + this.input.id + '-autocomplete-aria-live');
  this.db = db;

  $input
    .keydown(function (event) { return ac.onkeydown(this, event); })
    .keyup(function (event) { ac.onkeyup(this, event); })
    .blur(function () { ac.hidePopup(); ac.db.cancel(); });

};

/**
 * Handler for the "keydown" event.
 */
Drupal.jsAC.prototype.onkeydown = function (input, e) {
  if (!e) {
    e = window.event;
  }
  switch (e.keyCode) {
    case 40: // down arrow.
      this.selectDown();
      return false;
    case 38: // up arrow.
      this.selectUp();
      return false;
    default: // All other keys.
      return true;
  }
};

/**
 * Handler for the "keyup" event.
 */
Drupal.jsAC.prototype.onkeyup = function (input, e) {
  if (!e) {
    e = window.event;
  }
  switch (e.keyCode) {
    case 16: // Shift.
    case 17: // Ctrl.
    case 18: // Alt.
    case 20: // Caps lock.
    case 33: // Page up.
    case 34: // Page down.
    case 35: // End.
    case 36: // Home.
    case 37: // Left arrow.
    case 38: // Up arrow.
    case 39: // Right arrow.
    case 40: // Down arrow.
      return true;

    case 9:  // Tab.
    case 13: // Enter.
    case 27: // Esc.
      this.hidePopup(e.keyCode);
      return true;

    default: // All other keys.
      if (input.value.length > 0 && !input.readOnly) {
        this.populatePopup();
      }
      else {
        this.hidePopup(e.keyCode);
      }
      return true;
  }
};

/**
 * Puts the currently highlighted suggestion into the autocomplete field.
 */
Drupal.jsAC.prototype.select = function (node) {
  this.input.value = $(node).data('autocompleteValue');
  $(this.input).trigger('autocompleteSelect', [node]);
};

/**
 * Highlights the next suggestion.
 */
Drupal.jsAC.prototype.selectDown = function () {
  if (this.selected && this.selected.nextSibling) {
    this.highlight(this.selected.nextSibling);
  }
  else if (this.popup) {
    var lis = $('li', this.popup);
    if (lis.length > 0) {
      this.highlight(lis.get(0));
    }
  }
};

/**
 * Highlights the previous suggestion.
 */
Drupal.jsAC.prototype.selectUp = function () {
  if (this.selected && this.selected.previousSibling) {
    this.highlight(this.selected.previousSibling);
  }
};

/**
 * Highlights a suggestion.
 */
Drupal.jsAC.prototype.highlight = function (node) {
  if (this.selected) {
    $(this.selected).removeClass('selected');
  }
  $(node).addClass('selected');
  this.selected = node;
  $(this.ariaLive).html($(this.selected).html());
};

/**
 * Unhighlights a suggestion.
 */
Drupal.jsAC.prototype.unhighlight = function (node) {
  $(node).removeClass('selected');
  this.selected = false;
  $(this.ariaLive).empty();
};

/**
 * Hides the autocomplete suggestions.
 */
Drupal.jsAC.prototype.hidePopup = function (keycode) {
  // Select item if the right key or mousebutton was pressed.
  if (this.selected && ((keycode && keycode != 46 && keycode != 8 && keycode != 27) || !keycode)) {
    this.select(this.selected);
  }
  // Hide popup.
  var popup = this.popup;
  if (popup) {
    this.popup = null;
    $(popup).fadeOut('fast', function () { $(popup).remove(); });
  }
  this.selected = false;
  $(this.ariaLive).empty();
};

/**
 * Positions the suggestions popup and starts a search.
 */
Drupal.jsAC.prototype.populatePopup = function () {
  var $input = $(this.input);
  var position = $input.position();
  // Show popup.
  if (this.popup) {
    $(this.popup).remove();
  }
  this.selected = false;
  this.popup = $('<div id="autocomplete"></div>')[0];
  this.popup.owner = this;
  $(this.popup).css({
    top: parseInt(position.top + this.input.offsetHeight, 10) + 'px',
    left: parseInt(position.left, 10) + 'px',
    width: $input.innerWidth() + 'px',
    display: 'none'
  });
  $input.before(this.popup);

  // Do search.
  this.db.owner = this;
  this.db.search(this.input.value);
};

/**
 * Fills the suggestion popup with any matches received.
 */
Drupal.jsAC.prototype.found = function (matches) {
  // If no value in the textfield, do not show the popup.
  if (!this.input.value.length) {
    return false;
  }

  // Prepare matches.
  var ul = $('<ul></ul>');
  var ac = this;
  for (key in matches) {
    $('<li></li>')
      .html($('<div></div>').html(matches[key]))
      .mousedown(function () { ac.hidePopup(this); })
      .mouseover(function () { ac.highlight(this); })
      .mouseout(function () { ac.unhighlight(this); })
      .data('autocompleteValue', key)
      .appendTo(ul);
  }

  // Show popup with matches, if any.
  if (this.popup) {
    if (ul.children().length) {
      $(this.popup).empty().append(ul).show();
      $(this.ariaLive).html(Drupal.t('Autocomplete popup'));
    }
    else {
      $(this.popup).css({ visibility: 'hidden' });
      this.hidePopup();
    }
  }
};

Drupal.jsAC.prototype.setStatus = function (status) {
  switch (status) {
    case 'begin':
      $(this.input).addClass('throbbing');
      $(this.ariaLive).html(Drupal.t('Searching for matches...'));
      break;
    case 'cancel':
    case 'error':
    case 'found':
      $(this.input).removeClass('throbbing');
      break;
  }
};

/**
 * An AutoComplete DataBase object.
 */
Drupal.ACDB = function (uri) {
  this.uri = uri;
  this.delay = 300;
  this.cache = {};
};

/**
 * Performs a cached and delayed search.
 */
Drupal.ACDB.prototype.search = function (searchString) {
  var db = this;
  this.searchString = searchString;

  // See if this string needs to be searched for anyway. The pattern ../ is
  // stripped since it may be misinterpreted by the browser.
  searchString = searchString.replace(/^\s+|\.{2,}\/|\s+$/g, '');
  // Skip empty search strings, or search strings ending with a comma, since
  // that is the separator between search terms.
  if (searchString.length <= 0 ||
    searchString.charAt(searchString.length - 1) == ',') {
    return;
  }

  // See if this key has been searched for before.
  if (this.cache[searchString]) {
    return this.owner.found(this.cache[searchString]);
  }

  // Initiate delayed search.
  if (this.timer) {
    clearTimeout(this.timer);
  }
  this.timer = setTimeout(function () {
    db.owner.setStatus('begin');

    // Ajax GET request for autocompletion. We use Drupal.encodePath instead of
    // encodeURIComponent to allow autocomplete search terms to contain slashes.
    $.ajax({
      type: 'GET',
      url: db.uri + '/' + Drupal.encodePath(searchString),
      dataType: 'json',
      success: function (matches) {
        if (typeof matches.status == 'undefined' || matches.status != 0) {
          db.cache[searchString] = matches;
          // Verify if these are still the matches the user wants to see.
          if (db.searchString == searchString) {
            db.owner.found(matches);
          }
          db.owner.setStatus('found');
        }
      },
      error: function (xmlhttp) {
        alert(Drupal.ajaxError(xmlhttp, db.uri));
      }
    });
  }, this.delay);
};

/**
 * Cancels the current autocomplete request.
 */
Drupal.ACDB.prototype.cancel = function () {
  if (this.owner) this.owner.setStatus('cancel');
  if (this.timer) clearTimeout(this.timer);
  this.searchString = '';
};

})(jQuery);
;
(function ($) {

/**
 * Attaches double-click behavior to toggle full path of Krumo elements.
 */
Drupal.behaviors.devel = {
  attach: function (context, settings) {

    // Add hint to footnote
    $('.krumo-footnote .krumo-call').once().before('<img style="vertical-align: middle;" title="Click to expand. Double-click to show path." src="' + settings.basePath + 'misc/help.png"/>');

    var krumo_name = [];
    var krumo_type = [];

    function krumo_traverse(el) {
      krumo_name.push($(el).html());
      krumo_type.push($(el).siblings('em').html().match(/\w*/)[0]);

      if ($(el).closest('.krumo-nest').length > 0) {
        krumo_traverse($(el).closest('.krumo-nest').prev().find('.krumo-name'));
      }
    }

    $('.krumo-child > div:first-child', context).dblclick(
      function(e) {
        if ($(this).find('> .krumo-php-path').length > 0) {
          // Remove path if shown.
          $(this).find('> .krumo-php-path').remove();
        }
        else {
          // Get elements.
          krumo_traverse($(this).find('> a.krumo-name'));

          // Create path.
          var krumo_path_string = '';
          for (var i = krumo_name.length - 1; i >= 0; --i) {
            // Start element.
            if ((krumo_name.length - 1) == i)
              krumo_path_string += '$' + krumo_name[i];

            if (typeof krumo_name[(i-1)] !== 'undefined') {
              if (krumo_type[i] == 'Array') {
                krumo_path_string += "[";
                if (!/^\d*$/.test(krumo_name[(i-1)]))
                  krumo_path_string += "'";
                krumo_path_string += krumo_name[(i-1)];
                if (!/^\d*$/.test(krumo_name[(i-1)]))
                  krumo_path_string += "'";
                krumo_path_string += "]";
              }
              if (krumo_type[i] == 'Object')
                krumo_path_string += '->' + krumo_name[(i-1)];
            }
          }
          $(this).append('<div class="krumo-php-path" style="font-family: Courier, monospace; font-weight: bold;">' + krumo_path_string + '</div>');

          // Reset arrays.
          krumo_name = [];
          krumo_type = [];
        }
      }
    );
  }
};

})(jQuery);
;
(function ($) {

/**
 * Attaches sticky table headers.
 */
Drupal.behaviors.tableHeader = {
  attach: function (context, settings) {
    if (!$.support.positionFixed) {
      return;
    }

    $('table.sticky-enabled', context).once('tableheader', function () {
      $(this).data("drupal-tableheader", new Drupal.tableHeader(this));
    });
  }
};

/**
 * Constructor for the tableHeader object. Provides sticky table headers.
 *
 * @param table
 *   DOM object for the table to add a sticky header to.
 */
Drupal.tableHeader = function (table) {
  var self = this;

  this.originalTable = $(table);
  this.originalHeader = $(table).children('thead');
  this.originalHeaderCells = this.originalHeader.find('> tr > th');
  this.displayWeight = null;

  // React to columns change to avoid making checks in the scroll callback.
  this.originalTable.bind('columnschange', function (e, display) {
    // This will force header size to be calculated on scroll.
    self.widthCalculated = (self.displayWeight !== null && self.displayWeight === display);
    self.displayWeight = display;
  });

  // Clone the table header so it inherits original jQuery properties. Hide
  // the table to avoid a flash of the header clone upon page load.
  this.stickyTable = $('<table class="sticky-header"/>')
    .insertBefore(this.originalTable)
    .css({ position: 'fixed', top: '0px' });
  this.stickyHeader = this.originalHeader.clone(true)
    .hide()
    .appendTo(this.stickyTable);
  this.stickyHeaderCells = this.stickyHeader.find('> tr > th');

  this.originalTable.addClass('sticky-table');
  $(window)
    .bind('scroll.drupal-tableheader', $.proxy(this, 'eventhandlerRecalculateStickyHeader'))
    .bind('resize.drupal-tableheader', { calculateWidth: true }, $.proxy(this, 'eventhandlerRecalculateStickyHeader'))
    // Make sure the anchor being scrolled into view is not hidden beneath the
    // sticky table header. Adjust the scrollTop if it does.
    .bind('drupalDisplaceAnchor.drupal-tableheader', function () {
      window.scrollBy(0, -self.stickyTable.outerHeight());
    })
    // Make sure the element being focused is not hidden beneath the sticky
    // table header. Adjust the scrollTop if it does.
    .bind('drupalDisplaceFocus.drupal-tableheader', function (event) {
      if (self.stickyVisible && event.clientY < (self.stickyOffsetTop + self.stickyTable.outerHeight()) && event.$target.closest('sticky-header').length === 0) {
        window.scrollBy(0, -self.stickyTable.outerHeight());
      }
    })
    .triggerHandler('resize.drupal-tableheader');

  // We hid the header to avoid it showing up erroneously on page load;
  // we need to unhide it now so that it will show up when expected.
  this.stickyHeader.show();
};

/**
 * Event handler: recalculates position of the sticky table header.
 *
 * @param event
 *   Event being triggered.
 */
Drupal.tableHeader.prototype.eventhandlerRecalculateStickyHeader = function (event) {
  var self = this;
  var calculateWidth = event.data && event.data.calculateWidth;

  // Reset top position of sticky table headers to the current top offset.
  this.stickyOffsetTop = Drupal.settings.tableHeaderOffset ? eval(Drupal.settings.tableHeaderOffset + '()') : 0;
  this.stickyTable.css('top', this.stickyOffsetTop + 'px');

  // Save positioning data.
  var viewHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
  if (calculateWidth || this.viewHeight !== viewHeight) {
    this.viewHeight = viewHeight;
    this.vPosition = this.originalTable.offset().top - 4 - this.stickyOffsetTop;
    this.hPosition = this.originalTable.offset().left;
    this.vLength = this.originalTable[0].clientHeight - 100;
    calculateWidth = true;
  }

  // Track horizontal positioning relative to the viewport and set visibility.
  var hScroll = document.documentElement.scrollLeft || document.body.scrollLeft;
  var vOffset = (document.documentElement.scrollTop || document.body.scrollTop) - this.vPosition;
  this.stickyVisible = vOffset > 0 && vOffset < this.vLength;
  this.stickyTable.css({ left: (-hScroll + this.hPosition) + 'px', visibility: this.stickyVisible ? 'visible' : 'hidden' });

  // Only perform expensive calculations if the sticky header is actually
  // visible or when forced.
  if (this.stickyVisible && (calculateWidth || !this.widthCalculated)) {
    this.widthCalculated = true;
    var $that = null;
    var $stickyCell = null;
    var display = null;
    var cellWidth = null;
    // Resize header and its cell widths.
    // Only apply width to visible table cells. This prevents the header from
    // displaying incorrectly when the sticky header is no longer visible.
    for (var i = 0, il = this.originalHeaderCells.length; i < il; i += 1) {
      $that = $(this.originalHeaderCells[i]);
      $stickyCell = this.stickyHeaderCells.eq($that.index());
      display = $that.css('display');
      if (display !== 'none') {
        cellWidth = $that.css('width');
        // Exception for IE7.
        if (cellWidth === 'auto') {
          cellWidth = $that[0].clientWidth + 'px';
        }
        $stickyCell.css({'width': cellWidth, 'display': display});
      }
      else {
        $stickyCell.css('display', 'none');
      }
    }
    this.stickyTable.css('width', this.originalTable.outerWidth());
  }
};

})(jQuery);
;
