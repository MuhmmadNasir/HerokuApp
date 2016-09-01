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
/**
 * @file
 * JavaScript behaviors for the front-end display of webforms.
 */

(function ($) {

  "use strict";

  Drupal.behaviors.webform = Drupal.behaviors.webform || {};

  Drupal.behaviors.webform.attach = function (context) {
    // Calendar datepicker behavior.
    Drupal.webform.datepicker(context);

    // Conditional logic.
    if (Drupal.settings.webform && Drupal.settings.webform.conditionals) {
      Drupal.webform.conditional(context);
    }
  };

  Drupal.webform = Drupal.webform || {};

  Drupal.webform.datepicker = function (context) {
    $('div.webform-datepicker').each(function () {
      var $webformDatepicker = $(this);
      var $calendar = $webformDatepicker.find('input.webform-calendar');

      // Ensure the page we're on actually contains a datepicker.
      if ($calendar.length == 0) {
        return;
      }

      var startDate = $calendar[0].className.replace(/.*webform-calendar-start-(\d{4}-\d{2}-\d{2}).*/, '$1').split('-');
      var endDate = $calendar[0].className.replace(/.*webform-calendar-end-(\d{4}-\d{2}-\d{2}).*/, '$1').split('-');
      var firstDay = $calendar[0].className.replace(/.*webform-calendar-day-(\d).*/, '$1');
      // Convert date strings into actual Date objects.
      startDate = new Date(startDate[0], startDate[1] - 1, startDate[2]);
      endDate = new Date(endDate[0], endDate[1] - 1, endDate[2]);

      // Ensure that start comes before end for datepicker.
      if (startDate > endDate) {
        var laterDate = startDate;
        startDate = endDate;
        endDate = laterDate;
      }

      var startYear = startDate.getFullYear();
      var endYear = endDate.getFullYear();

      // Set up the jQuery datepicker element.
      $calendar.datepicker({
        dateFormat: 'yy-mm-dd',
        yearRange: startYear + ':' + endYear,
        firstDay: parseInt(firstDay),
        minDate: startDate,
        maxDate: endDate,
        onSelect: function (dateText, inst) {
          var date = dateText.split('-');
          $webformDatepicker.find('select.year, input.year').val(+date[0]).trigger('change');
          $webformDatepicker.find('select.month').val(+date[1]).trigger('change');
          $webformDatepicker.find('select.day').val(+date[2]).trigger('change');
        },
        beforeShow: function (input, inst) {
          // Get the select list values.
          var year = $webformDatepicker.find('select.year, input.year').val();
          var month = $webformDatepicker.find('select.month').val();
          var day = $webformDatepicker.find('select.day').val();

          // If empty, default to the current year/month/day in the popup.
          var today = new Date();
          year = year ? year : today.getFullYear();
          month = month ? month : today.getMonth() + 1;
          day = day ? day : today.getDate();

          // Make sure that the default year fits in the available options.
          year = (year < startYear || year > endYear) ? startYear : year;

          // jQuery UI Datepicker will read the input field and base its date off
          // of that, even though in our case the input field is a button.
          $(input).val(year + '-' + month + '-' + day);
        }
      });

      // Prevent the calendar button from submitting the form.
      $calendar.click(function (event) {
        $(this).focus();
        event.preventDefault();
      });
    });
  };

  Drupal.webform.conditional = function (context) {
    // Add the bindings to each webform on the page.
    $.each(Drupal.settings.webform.conditionals, function (formKey, settings) {
      var $form = $('.' + formKey + ':not(.webform-conditional-processed)');
      $form.each(function (index, currentForm) {
        var $currentForm = $(currentForm);
        $currentForm.addClass('webform-conditional-processed');
        $currentForm.bind('change', {'settings': settings}, Drupal.webform.conditionalCheck);

        // Trigger all the elements that cause conditionals on this form.
        Drupal.webform.doConditions($form, settings);
      });
    });
  };

  /**
   * Event handler to respond to field changes in a form.
   *
   * This event is bound to the entire form, not individual fields.
   */
  Drupal.webform.conditionalCheck = function (e) {
    var $triggerElement = $(e.target).closest('.webform-component');
    var $form = $triggerElement.closest('form');
    var triggerElementKey = $triggerElement.attr('class').match(/webform-component--[^ ]+/)[0];
    var settings = e.data.settings;
    if (settings.sourceMap[triggerElementKey]) {
      Drupal.webform.doConditions($form, settings);
    }
  };

  /**
   * Processes all conditional.
   */
  Drupal.webform.doConditions = function ($form, settings) {

    var stackPointer;
    var resultStack;

    /**
     * Initializes an execution stack for a conditional group's rules and
     * sub-conditional rules.
     */
    function executionStackInitialize(andor) {
      stackPointer = -1;
      resultStack = [];
      executionStackPush(andor);
    }

    /**
     * Starts a new subconditional for the given and/or operator.
     */
    function executionStackPush(andor) {
      resultStack[++stackPointer] = {
        results: [],
        andor: andor,
      };
    }

    /**
     * Adds a rule's result to the current sub-condtional.
     */
    function executionStackAccumulate(result) {
      resultStack[stackPointer]['results'].push(result);
    }

    /**
     * Finishes a sub-conditional and adds the result to the parent stack frame.
     */
    function executionStackPop() {
      // Calculate the and/or result.
      var stackFrame = resultStack[stackPointer];
      // Pop stack and protect against stack underflow.
      stackPointer = Math.max(0, stackPointer - 1);
      var $conditionalResults = stackFrame['results'];
      var filteredResults = $.map($conditionalResults, function(val) {
        return val ? val : null;
      });
      return stackFrame['andor'] === 'or'
                ? filteredResults.length > 0
                : filteredResults.length === $conditionalResults.length;
    }

    // Track what has be set/shown for each target component.
    var targetLocked = [];

    $.each(settings.ruleGroups, function (rgid_key, rule_group) {
      var ruleGroup = settings.ruleGroups[rgid_key];

      // Perform the comparison callback and build the results for this group.
      executionStackInitialize(ruleGroup['andor']);
      $.each(ruleGroup['rules'], function (m, rule) {
        switch (rule['source_type']) {
          case 'component':
            var elementKey = rule['source'];
            var element = $form.find('.' + elementKey)[0];
            var existingValue = settings.values[elementKey] ? settings.values[elementKey] : null;
            executionStackAccumulate(window['Drupal']['webform'][rule.callback](element, existingValue, rule['value']));
            break;
          case 'conditional_start':
            executionStackPush(rule['andor']);
            break;
          case 'conditional_end':
            executionStackAccumulate(executionStackPop());
            break;
        }
      });
      var conditionalResult = executionStackPop();

      $.each(ruleGroup['actions'], function (aid, action) {
        var $target = $form.find('.' + action['target']);
        var actionResult = action['invert'] ? !conditionalResult : conditionalResult;
        switch (action['action']) {
          case 'show':
            if (actionResult != Drupal.webform.isVisible($target)) {
              var $targetElements = actionResult
                                      ? $target.find('.webform-conditional-disabled').removeClass('webform-conditional-disabled')
                                      : $target.find(':input').addClass('webform-conditional-disabled');
              $targetElements.webformProp('disabled', !actionResult);
              $target.toggleClass('webform-conditional-hidden', !actionResult);
              if (actionResult) {
                $target.show();
              }
              else {
                $target.hide();
                // Record that the target was hidden.
                targetLocked[action['target']] = 'hide';
              }
              if ($target.is('tr')) {
                Drupal.webform.restripeTable($target.closest('table').first());
              }
            }
            break;
          case 'require':
            var $requiredSpan = $target.find('.form-required, .form-optional').first();
            if (actionResult != $requiredSpan.hasClass('form-required')) {
              var $targetInputElements = $target.find("input:text,textarea,input[type='email'],select,input:radio,input:file");
              // Rather than hide the required tag, remove it so that other jQuery can respond via Drupal behaviors.
              Drupal.detachBehaviors($requiredSpan);
              $targetInputElements
                .webformProp('required', actionResult)
                .toggleClass('required', actionResult);
              if (actionResult) {
                $requiredSpan.replaceWith('<span class="form-required" title="' + Drupal.t('This field is required.') + '">*</span>');
              }
              else {
                $requiredSpan.replaceWith('<span class="form-optional"></span>');
              }
              Drupal.attachBehaviors($requiredSpan);
            }
            break;
          case 'set':
            var isLocked = targetLocked[action['target']];
            var $texts = $target.find("input:text,textarea,input[type='email']");
            var $selects = $target.find('select,select option,input:radio,input:checkbox');
            var $markups = $target.filter('.webform-component-markup');
            if (actionResult) {
              var multiple = $.map(action['argument'].split(','), $.trim);
              $selects.webformVal(multiple);
              $texts.val([action['argument']]);
              // A special case is made for markup. It is sanitized with filter_xss_admin on the server.
              // otherwise text() should be used to avoid an XSS vulnerability. text() however would
              // preclude the use of tags like <strong> or <a>
              $markups.html(action['argument']);
            }
            else {
              // Markup not set? Then restore original markup as provided in
              // the attribute data-webform-markup.
              $markups.each(function() {
                var $this = $(this);
                var original = $this.data('webform-markup');
                if (original !== undefined) {
                  $this.html(original);
                }
              });
            }
            if (!isLocked) {
              // If not previously hidden or set, disable the element readonly or readonly-like behavior.
              $selects.webformProp('disabled', actionResult);
              $texts.webformProp('readonly', actionResult);
              targetLocked[action['target']] = actionResult ? 'set' : false;
            }
            break;
        }
      }); // End look on each action for one conditional
    }); // End loop on each conditional
  };

  /**
   * Event handler to prevent propogation of events, typically click for disabling
   * radio and checkboxes.
   */
  Drupal.webform.stopEvent = function () {
    return false;
  };

  Drupal.webform.conditionalOperatorStringEqual = function (element, existingValue, ruleValue) {
    var returnValue = false;
    var currentValue = Drupal.webform.stringValue(element, existingValue);
    $.each(currentValue, function (n, value) {
      if (value.toLowerCase() === ruleValue.toLowerCase()) {
        returnValue = true;
        return false; // break.
      }
    });
    return returnValue;
  };

  Drupal.webform.conditionalOperatorStringNotEqual = function (element, existingValue, ruleValue) {
    var found = false;
    var currentValue = Drupal.webform.stringValue(element, existingValue);
    $.each(currentValue, function (n, value) {
      if (value.toLowerCase() === ruleValue.toLowerCase()) {
        found = true;
      }
    });
    return !found;
  };

  Drupal.webform.conditionalOperatorStringContains = function (element, existingValue, ruleValue) {
    var returnValue = false;
    var currentValue = Drupal.webform.stringValue(element, existingValue);
    $.each(currentValue, function (n, value) {
      if (value.toLowerCase().indexOf(ruleValue.toLowerCase()) > -1) {
        returnValue = true;
        return false; // break.
      }
    });
    return returnValue;
  };

  Drupal.webform.conditionalOperatorStringDoesNotContain = function (element, existingValue, ruleValue) {
    var found = false;
    var currentValue = Drupal.webform.stringValue(element, existingValue);
    $.each(currentValue, function (n, value) {
      if (value.toLowerCase().indexOf(ruleValue.toLowerCase()) > -1) {
        found = true;
      }
    });
    return !found;
  };

  Drupal.webform.conditionalOperatorStringBeginsWith = function (element, existingValue, ruleValue) {
    var returnValue = false;
    var currentValue = Drupal.webform.stringValue(element, existingValue);
    $.each(currentValue, function (n, value) {
      if (value.toLowerCase().indexOf(ruleValue.toLowerCase()) === 0) {
        returnValue = true;
        return false; // break.
      }
    });
    return returnValue;
  };

  Drupal.webform.conditionalOperatorStringEndsWith = function (element, existingValue, ruleValue) {
    var returnValue = false;
    var currentValue = Drupal.webform.stringValue(element, existingValue);
    $.each(currentValue, function (n, value) {
      if (value.toLowerCase().lastIndexOf(ruleValue.toLowerCase()) === value.length - ruleValue.length) {
        returnValue = true;
        return false; // break.
      }
    });
    return returnValue;
  };

  Drupal.webform.conditionalOperatorStringEmpty = function (element, existingValue, ruleValue) {
    var currentValue = Drupal.webform.stringValue(element, existingValue);
    var returnValue = true;
    $.each(currentValue, function (n, value) {
      if (value !== '') {
        returnValue = false;
        return false; // break.
      }
    });
    return returnValue;
  };

  Drupal.webform.conditionalOperatorStringNotEmpty = function (element, existingValue, ruleValue) {
    return !Drupal.webform.conditionalOperatorStringEmpty(element, existingValue, ruleValue);
  };

  Drupal.webform.conditionalOperatorSelectGreaterThan = function (element, existingValue, ruleValue) {
    var currentValue = Drupal.webform.stringValue(element, existingValue);
    return Drupal.webform.compare_select(currentValue[0], ruleValue, element) > 0;
  };

  Drupal.webform.conditionalOperatorSelectGreaterThanEqual = function (element, existingValue, ruleValue) {
    var currentValue = Drupal.webform.stringValue(element, existingValue);
    var comparison = Drupal.webform.compare_select(currentValue[0], ruleValue, element);
    return comparison > 0 || comparison === 0;
  };

  Drupal.webform.conditionalOperatorSelectLessThan = function (element, existingValue, ruleValue) {
    var currentValue = Drupal.webform.stringValue(element, existingValue);
    return Drupal.webform.compare_select(currentValue[0], ruleValue, element) < 0;
  };

  Drupal.webform.conditionalOperatorSelectLessThanEqual = function (element, existingValue, ruleValue) {
    var currentValue = Drupal.webform.stringValue(element, existingValue);
    var comparison = Drupal.webform.compare_select(currentValue[0], ruleValue, element);
    return comparison < 0 || comparison === 0;
  };

  Drupal.webform.conditionalOperatorNumericEqual = function (element, existingValue, ruleValue) {
    // See float comparison: http://php.net/manual/en/language.types.float.php
    var currentValue = Drupal.webform.stringValue(element, existingValue);
    var epsilon = 0.000001;
    // An empty string does not match any number.
    return currentValue[0] === '' ? false : (Math.abs(parseFloat(currentValue[0]) - parseFloat(ruleValue)) < epsilon);
  };

  Drupal.webform.conditionalOperatorNumericNotEqual = function (element, existingValue, ruleValue) {
    // See float comparison: http://php.net/manual/en/language.types.float.php
    var currentValue = Drupal.webform.stringValue(element, existingValue);
    var epsilon = 0.000001;
    // An empty string does not match any number.
    return currentValue[0] === '' ? true : (Math.abs(parseFloat(currentValue[0]) - parseFloat(ruleValue)) >= epsilon);
  };

  Drupal.webform.conditionalOperatorNumericGreaterThan = function (element, existingValue, ruleValue) {
    var currentValue = Drupal.webform.stringValue(element, existingValue);
    return parseFloat(currentValue[0]) > parseFloat(ruleValue);
  };

  Drupal.webform.conditionalOperatorNumericGreaterThanEqual = function (element, existingValue, ruleValue) {
    return Drupal.webform.conditionalOperatorNumericGreaterThan(element, existingValue, ruleValue) ||
           Drupal.webform.conditionalOperatorNumericEqual(element, existingValue, ruleValue);
  };

  Drupal.webform.conditionalOperatorNumericLessThan = function (element, existingValue, ruleValue) {
    var currentValue = Drupal.webform.stringValue(element, existingValue);
    return parseFloat(currentValue[0]) < parseFloat(ruleValue);
  };

  Drupal.webform.conditionalOperatorNumericLessThanEqual = function (element, existingValue, ruleValue) {
    return Drupal.webform.conditionalOperatorNumericLessThan(element, existingValue, ruleValue) ||
           Drupal.webform.conditionalOperatorNumericEqual(element, existingValue, ruleValue);
  };

  Drupal.webform.conditionalOperatorDateEqual = function (element, existingValue, ruleValue) {
    var currentValue = Drupal.webform.dateValue(element, existingValue);
    return currentValue === ruleValue;
  };

  Drupal.webform.conditionalOperatorDateNotEqual = function (element, existingValue, ruleValue) {
    return !Drupal.webform.conditionalOperatorDateEqual(element, existingValue, ruleValue);
  };

  Drupal.webform.conditionalOperatorDateBefore = function (element, existingValue, ruleValue) {
    var currentValue = Drupal.webform.dateValue(element, existingValue);
    return (currentValue !== false) && currentValue < ruleValue;
  };

  Drupal.webform.conditionalOperatorDateBeforeEqual = function (element, existingValue, ruleValue) {
    var currentValue = Drupal.webform.dateValue(element, existingValue);
    return (currentValue !== false) && (currentValue < ruleValue || currentValue === ruleValue);
  };

  Drupal.webform.conditionalOperatorDateAfter = function (element, existingValue, ruleValue) {
    var currentValue = Drupal.webform.dateValue(element, existingValue);
    return (currentValue !== false) && currentValue > ruleValue;
  };

  Drupal.webform.conditionalOperatorDateAfterEqual = function (element, existingValue, ruleValue) {
    var currentValue = Drupal.webform.dateValue(element, existingValue);
    return (currentValue !== false) && (currentValue > ruleValue || currentValue === ruleValue);
  };

  Drupal.webform.conditionalOperatorTimeEqual = function (element, existingValue, ruleValue) {
    var currentValue = Drupal.webform.timeValue(element, existingValue);
    return currentValue === ruleValue;
  };

  Drupal.webform.conditionalOperatorTimeNotEqual = function (element, existingValue, ruleValue) {
    return !Drupal.webform.conditionalOperatorTimeEqual(element, existingValue, ruleValue);
  };

  Drupal.webform.conditionalOperatorTimeBefore = function (element, existingValue, ruleValue) {
    // Date and time operators intentionally exclusive for "before".
    var currentValue = Drupal.webform.timeValue(element, existingValue);
    return (currentValue !== false) && (currentValue < ruleValue);
  };

  Drupal.webform.conditionalOperatorTimeBeforeEqual = function (element, existingValue, ruleValue) {
    // Date and time operators intentionally exclusive for "before".
    var currentValue = Drupal.webform.timeValue(element, existingValue);
    return (currentValue !== false) && (currentValue < ruleValue || currentValue === ruleValue);
  };

  Drupal.webform.conditionalOperatorTimeAfter = function (element, existingValue, ruleValue) {
    // Date and time operators intentionally inclusive for "after".
    var currentValue = Drupal.webform.timeValue(element, existingValue);
    return (currentValue !== false) && (currentValue > ruleValue);
  };

  Drupal.webform.conditionalOperatorTimeAfterEqual = function (element, existingValue, ruleValue) {
    // Date and time operators intentionally inclusive for "after".
    var currentValue = Drupal.webform.timeValue(element, existingValue);
    return (currentValue !== false) && (currentValue > ruleValue || currentValue === ruleValue);
  };

  /**
   * Utility function to compare values of a select component.
   * @param string a
   *   First select option key to compare
   * @param string b
   *   Second select option key to compare
   * @param array options
   *   Associative array where the a and b are within the keys
   * @return integer based upon position of $a and $b in $options
   *   -N if $a above (<) $b
   *   0 if $a = $b
   *   +N if $a is below (>) $b
   */
  Drupal.webform.compare_select = function (a, b, element) {
    var optionList = [];
    $('option,input:radio,input:checkbox', element).each(function () {
      optionList.push($(this).val());
    });
    var a_position = optionList.indexOf(a);
    var b_position = optionList.indexOf(b);
    return (a_position < 0 || b_position < 0) ? null : a_position - b_position;
  };

  /**
   * Utility to return current visibility. Uses actual visibility, except for
   * hidden components which use the applied disabled class.
   */
  Drupal.webform.isVisible = function ($element) {
    return $element.hasClass('webform-component-hidden')
              ? !$element.find('input').first().hasClass('webform-conditional-disabled')
              : $element.closest('.webform-conditional-hidden').length == 0;
  };

  /**
   * Utility function to get a string value from a select/radios/text/etc. field.
   */
  Drupal.webform.stringValue = function (element, existingValue) {
    var value = [];
    if (element) {
      var $element = $(element);
      if (Drupal.webform.isVisible($element)) {
        // Checkboxes and radios.
        $element.find('input[type=checkbox]:checked,input[type=radio]:checked').each(function () {
          value.push(this.value);
        });
        // Select lists.
        if (!value.length) {
          var selectValue = $element.find('select').val();
          if (selectValue) {
            if ($.isArray(selectValue)) {
              value = selectValue;
            }
            else {
              value.push(selectValue);
            }
          }
        }
        // Simple text fields. This check is done last so that the select list in
        // select-or-other fields comes before the "other" text field.
        if (!value.length) {
          $element.find('input:not([type=checkbox],[type=radio]),textarea').each(function () {
            value.push(this.value);
          });
        }
      }
    }
    else {
      switch ($.type(existingValue)) {
        case 'array':
          value = existingValue;
          break;
        case 'string':
          value.push(existingValue);
          break;
      }
    }
    return value;
  };

  /**
   * Utility function to calculate a second-based timestamp from a time field.
   */
  Drupal.webform.dateValue = function (element, existingValue) {
    var value = false;
    if (element) {
      var $element = $(element);
      if (Drupal.webform.isVisible($element)) {
        var day = $element.find('[name*=day]').val();
        var month = $element.find('[name*=month]').val();
        var year = $element.find('[name*=year]').val();
        // Months are 0 indexed in JavaScript.
        if (month) {
          month--;
        }
        if (year !== '' && month !== '' && day !== '') {
          value = Date.UTC(year, month, day) / 1000;
        }
      }
    }
    else {
      if ($.type(existingValue) === 'array' && existingValue.length) {
        existingValue = existingValue[0];
      }
      if ($.type(existingValue) === 'string') {
        existingValue = existingValue.split('-');
      }
      if (existingValue.length === 3) {
        value = Date.UTC(existingValue[0], existingValue[1], existingValue[2]) / 1000;
      }
    }
    return value;
  };

  /**
   * Utility function to calculate a millisecond timestamp from a time field.
   */
  Drupal.webform.timeValue = function (element, existingValue) {
    var value = false;
    if (element) {
      var $element = $(element);
      if (Drupal.webform.isVisible($element)) {
        var hour = $element.find('[name*=hour]').val();
        var minute = $element.find('[name*=minute]').val();
        var ampm = $element.find('[name*=ampm]:checked').val();

        // Convert to integers if set.
        hour = (hour === '') ? hour : parseInt(hour);
        minute = (minute === '') ? minute : parseInt(minute);

        if (hour !== '') {
          hour = (hour < 12 && ampm == 'pm') ? hour + 12 : hour;
          hour = (hour === 12 && ampm == 'am') ? 0 : hour;
        }
        if (hour !== '' && minute !== '') {
          value = Date.UTC(1970, 0, 1, hour, minute) / 1000;
        }
      }
    }
    else {
      if ($.type(existingValue) === 'array' && existingValue.length) {
        existingValue = existingValue[0];
      }
      if ($.type(existingValue) === 'string') {
        existingValue = existingValue.split(':');
      }
      if (existingValue.length >= 2) {
        value = Date.UTC(1970, 0, 1, existingValue[0], existingValue[1]) / 1000;
      }
    }
    return value;
  };

  /**
   * Make a prop shim for jQuery < 1.9.
   */
  $.fn.webformProp = $.fn.webformProp || function (name, value) {
    if (value) {
      return $.fn.prop ? this.prop(name, true) : this.attr(name, true);
    }
    else {
      return $.fn.prop ? this.prop(name, false) : this.removeAttr(name);
    }
  };

  /**
   * Make a multi-valued val() function for setting checkboxes, radios, and select
   * elements.
   */
  $.fn.webformVal = function (values) {
    this.each(function () {
      var $this = $(this);
      var value = $this.val();
      var on = $.inArray($this.val(), values) != -1;
      if (this.nodeName == 'OPTION') {
        $this.webformProp('selected', on ? value : false);
      }
      else {
        $this.val(on ? [value] : false);
      }
    });
    return this;
  };

  /**
   * Given a table's DOM element, restripe the odd/even classes.
   */
  Drupal.webform.restripeTable = function (table) {
    // :even and :odd are reversed because jQuery counts from 0 and
    // we count from 1, so we're out of sync.
    // Match immediate children of the parent element to allow nesting.
    $('> tbody > tr, > tr', table)
      .filter(':visible:odd').filter('.odd')
        .removeClass('odd').addClass('even')
      .end().end()
      .filter(':visible:even').filter('.even')
        .removeClass('even').addClass('odd');
  };

})(jQuery);
;
/**
 * @file
 * Some basic behaviors and utility functions for Views.
 */
(function ($) {

Drupal.Views = {};

/**
 * jQuery UI tabs, Views integration component
 */
Drupal.behaviors.viewsTabs = {
  attach: function (context) {
    if ($.viewsUi && $.viewsUi.tabs) {
      $('#views-tabset').once('views-processed').viewsTabs({
        selectedClass: 'active'
      });
    }

    $('a.views-remove-link').once('views-processed').click(function(event) {
      var id = $(this).attr('id').replace('views-remove-link-', '');
      $('#views-row-' + id).hide();
      $('#views-removed-' + id).attr('checked', true);
      event.preventDefault();
   });
  /**
    * Here is to handle display deletion
    * (checking in the hidden checkbox and hiding out the row)
    */
  $('a.display-remove-link')
    .addClass('display-processed')
    .click(function() {
      var id = $(this).attr('id').replace('display-remove-link-', '');
      $('#display-row-' + id).hide();
      $('#display-removed-' + id).attr('checked', true);
      return false;
  });
  }
};

/**
 * Helper function to parse a querystring.
 */
Drupal.Views.parseQueryString = function (query) {
  var args = {};
  var pos = query.indexOf('?');
  if (pos != -1) {
    query = query.substring(pos + 1);
  }
  var pairs = query.split('&');
  for(var i in pairs) {
    if (typeof(pairs[i]) == 'string') {
      var pair = pairs[i].split('=');
      // Ignore the 'q' path argument, if present.
      if (pair[0] != 'q' && pair[1]) {
        args[decodeURIComponent(pair[0].replace(/\+/g, ' '))] = decodeURIComponent(pair[1].replace(/\+/g, ' '));
      }
    }
  }
  return args;
};

/**
 * Helper function to return a view's arguments based on a path.
 */
Drupal.Views.parseViewArgs = function (href, viewPath) {
  var returnObj = {};
  var path = Drupal.Views.getPath(href);
  // Ensure we have a correct path.
  if (viewPath && path.substring(0, viewPath.length + 1) == viewPath + '/') {
    var args = decodeURIComponent(path.substring(viewPath.length + 1, path.length));
    returnObj.view_args = args;
    returnObj.view_path = path;
  }
  return returnObj;
};

/**
 * Strip off the protocol plus domain from an href.
 */
Drupal.Views.pathPortion = function (href) {
  // Remove e.g. http://example.com if present.
  var protocol = window.location.protocol;
  if (href.substring(0, protocol.length) == protocol) {
    // 2 is the length of the '//' that normally follows the protocol
    href = href.substring(href.indexOf('/', protocol.length + 2));
  }
  return href;
};

/**
 * Return the Drupal path portion of an href.
 */
Drupal.Views.getPath = function (href) {
  href = Drupal.Views.pathPortion(href);
  href = href.substring(Drupal.settings.basePath.length, href.length);
  // 3 is the length of the '?q=' added to the url without clean urls.
  if (href.substring(0, 3) == '?q=') {
    href = href.substring(3, href.length);
  }
  var chars = ['#', '?', '&'];
  for (i in chars) {
    if (href.indexOf(chars[i]) > -1) {
      href = href.substr(0, href.indexOf(chars[i]));
    }
  }
  return href;
};

})(jQuery);
;
(function ($) {

/**
 * A progressbar object. Initialized with the given id. Must be inserted into
 * the DOM afterwards through progressBar.element.
 *
 * method is the function which will perform the HTTP request to get the
 * progress bar state. Either "GET" or "POST".
 *
 * e.g. pb = new progressBar('myProgressBar');
 *      some_element.appendChild(pb.element);
 */
Drupal.progressBar = function (id, updateCallback, method, errorCallback) {
  var pb = this;
  this.id = id;
  this.method = method || 'GET';
  this.updateCallback = updateCallback;
  this.errorCallback = errorCallback;

  // The WAI-ARIA setting aria-live="polite" will announce changes after users
  // have completed their current activity and not interrupt the screen reader.
  this.element = $('<div class="progress" aria-live="polite"></div>').attr('id', id);
  this.element.html('<div class="bar"><div class="filled"></div></div>' +
                    '<div class="percentage"></div>' +
                    '<div class="message">&nbsp;</div>');
};

/**
 * Set the percentage and status message for the progressbar.
 */
Drupal.progressBar.prototype.setProgress = function (percentage, message) {
  if (percentage >= 0 && percentage <= 100) {
    $('div.filled', this.element).css('width', percentage + '%');
    $('div.percentage', this.element).html(percentage + '%');
  }
  $('div.message', this.element).html(message);
  if (this.updateCallback) {
    this.updateCallback(percentage, message, this);
  }
};

/**
 * Start monitoring progress via Ajax.
 */
Drupal.progressBar.prototype.startMonitoring = function (uri, delay) {
  this.delay = delay;
  this.uri = uri;
  this.sendPing();
};

/**
 * Stop monitoring progress via Ajax.
 */
Drupal.progressBar.prototype.stopMonitoring = function () {
  clearTimeout(this.timer);
  // This allows monitoring to be stopped from within the callback.
  this.uri = null;
};

/**
 * Request progress data from server.
 */
Drupal.progressBar.prototype.sendPing = function () {
  if (this.timer) {
    clearTimeout(this.timer);
  }
  if (this.uri) {
    var pb = this;
    // When doing a post request, you need non-null data. Otherwise a
    // HTTP 411 or HTTP 406 (with Apache mod_security) error may result.
    $.ajax({
      type: this.method,
      url: this.uri,
      data: '',
      dataType: 'json',
      success: function (progress) {
        // Display errors.
        if (progress.status == 0) {
          pb.displayError(progress.data);
          return;
        }
        // Update display.
        pb.setProgress(progress.percentage, progress.message);
        // Schedule next timer.
        pb.timer = setTimeout(function () { pb.sendPing(); }, pb.delay);
      },
      error: function (xmlhttp) {
        pb.displayError(Drupal.ajaxError(xmlhttp, pb.uri));
      }
    });
  }
};

/**
 * Display errors on the page.
 */
Drupal.progressBar.prototype.displayError = function (string) {
  var error = $('<div class="messages error"></div>').html(string);
  $(this.element).before(error).hide();

  if (this.errorCallback) {
    this.errorCallback(this);
  }
};

})(jQuery);
;
/**
 * @file
 * Handles AJAX fetching of views, including filter submission and response.
 */
(function ($) {

/**
 * Attaches the AJAX behavior to Views exposed filter forms and key View links.
 */
Drupal.behaviors.ViewsAjaxView = {};
Drupal.behaviors.ViewsAjaxView.attach = function() {
  if (Drupal.settings && Drupal.settings.views && Drupal.settings.views.ajaxViews) {
    $.each(Drupal.settings.views.ajaxViews, function(i, settings) {
      Drupal.views.instances[i] = new Drupal.views.ajaxView(settings);
    });
  }
};

Drupal.views = {};
Drupal.views.instances = {};

/**
 * Javascript object for a certain view.
 */
Drupal.views.ajaxView = function(settings) {
  var selector = '.view-dom-id-' + settings.view_dom_id;
  this.$view = $(selector);

  // Retrieve the path to use for views' ajax.
  var ajax_path = Drupal.settings.views.ajax_path;

  // If there are multiple views this might've ended up showing up multiple times.
  if (ajax_path.constructor.toString().indexOf("Array") != -1) {
    ajax_path = ajax_path[0];
  }

  // Check if there are any GET parameters to send to views.
  var queryString = window.location.search || '';
  if (queryString !== '') {
    // Remove the question mark and Drupal path component if any.
    var queryString = queryString.slice(1).replace(/q=[^&]+&?|&?render=[^&]+/, '');
    if (queryString !== '') {
      // If there is a '?' in ajax_path, clean url are on and & should be used to add parameters.
      queryString = ((/\?/.test(ajax_path)) ? '&' : '?') + queryString;
    }
  }

  this.element_settings = {
    url: ajax_path + queryString,
    submit: settings,
    setClick: true,
    event: 'click',
    selector: selector,
    progress: { type: 'throbber' }
  };

  this.settings = settings;

  // Add the ajax to exposed forms.
  this.$exposed_form = $('#views-exposed-form-'+ settings.view_name.replace(/_/g, '-') + '-' + settings.view_display_id.replace(/_/g, '-'));
  this.$exposed_form.once(jQuery.proxy(this.attachExposedFormAjax, this));

  // Add the ajax to pagers.
  this.$view
    // Don't attach to nested views. Doing so would attach multiple behaviors
    // to a given element.
    .filter(jQuery.proxy(this.filterNestedViews, this))
    .once(jQuery.proxy(this.attachPagerAjax, this));

  // Add a trigger to update this view specifically. In order to trigger a
  // refresh use the following code.
  //
  // @code
  // jQuery('.view-name').trigger('RefreshView');
  // @endcode
  // Add a trigger to update this view specifically.
  var self_settings = this.element_settings;
  self_settings.event = 'RefreshView';
  this.refreshViewAjax = new Drupal.ajax(this.selector, this.$view, self_settings);
};

Drupal.views.ajaxView.prototype.attachExposedFormAjax = function() {
  var button = $('input[type=submit], button[type=submit], input[type=image]', this.$exposed_form);
  button = button[0];

  this.exposedFormAjax = new Drupal.ajax($(button).attr('id'), button, this.element_settings);
};

Drupal.views.ajaxView.prototype.filterNestedViews= function() {
  // If there is at least one parent with a view class, this view
  // is nested (e.g., an attachment). Bail.
  return !this.$view.parents('.view').size();
};

/**
 * Attach the ajax behavior to each link.
 */
Drupal.views.ajaxView.prototype.attachPagerAjax = function() {
  this.$view.find('ul.pager > li > a, th.views-field a, .attachment .views-summary a')
  .each(jQuery.proxy(this.attachPagerLinkAjax, this));
};

/**
 * Attach the ajax behavior to a singe link.
 */
Drupal.views.ajaxView.prototype.attachPagerLinkAjax = function(id, link) {
  var $link = $(link);
  var viewData = {};
  var href = $link.attr('href');
  // Construct an object using the settings defaults and then overriding
  // with data specific to the link.
  $.extend(
    viewData,
    this.settings,
    Drupal.Views.parseQueryString(href),
    // Extract argument data from the URL.
    Drupal.Views.parseViewArgs(href, this.settings.view_base_path)
  );

  // For anchor tags, these will go to the target of the anchor rather
  // than the usual location.
  $.extend(viewData, Drupal.Views.parseViewArgs(href, this.settings.view_base_path));

  this.element_settings.submit = viewData;
  this.pagerAjax = new Drupal.ajax(false, $link, this.element_settings);
};

Drupal.ajax.prototype.commands.viewsScrollTop = function (ajax, response, status) {
  // Scroll to the top of the view. This will allow users
  // to browse newly loaded content after e.g. clicking a pager
  // link.
  var offset = $(response.selector).offset();
  // We can't guarantee that the scrollable object should be
  // the body, as the view could be embedded in something
  // more complex such as a modal popup. Recurse up the DOM
  // and scroll the first element that has a non-zero top.
  var scrollTarget = response.selector;
  while ($(scrollTarget).scrollTop() == 0 && $(scrollTarget).parent()) {
    scrollTarget = $(scrollTarget).parent();
  }
  // Only scroll upward
  if (offset.top - 10 < $(scrollTarget).scrollTop()) {
    $(scrollTarget).animate({scrollTop: (offset.top - 10)}, 500);
  }
};

})(jQuery);
;
