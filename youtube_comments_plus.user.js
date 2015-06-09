// ==UserScript==
// @name        YouTube Comments Plus
// @namespace   jojje/gm
// @description Fetches all comments and allows for inverting the sorting order
// @require     http://code.jquery.com/jquery-1.9.1.min.js
// @include     https://www.youtube.com/watch?v=*
// @downloadURL https://raw.githubusercontent.com/jojje/ytc-plus/master/youtube_comments_plus.user.js
// @updateURL   https://raw.githubusercontent.com/jojje/ytc-plus/master/youtube_comments_plus.user.js
// @homepageURL https://github.com/jojje/ytc-plus
// @author      jojje
// @version     1.0
// @grant       none
// ==/UserScript==

var anchorFilter = '#yt-comments-order-button';
var state = "idle";

//==============================================
// Main logic
//==============================================

function updateProgress(n, total) {
  var pct  = Math.round(100*n/total),
      spct = ''+ pct +'%';

  $('#f-percent').html(spct);
  $('#f-bar').css('width',spct);
  $('#f-progress').show();

  log("updating stats: "+ n + "/"+ total +": " + spct);  
}
function hideProgress() {
  $('#f-progress').fadeOut('slow');
}

function fetchReplies() {
  $('.load-comments:visible').each(function() {
    var self = $(this), observer;
    
    observer = onAttributeChange(self[0], function() {  // Element changes class attribute when replies are fetched
      if(self.hasClass('hid')) {                        //  by adding hid class.
        observer.disconnect();                          // Stop listening to this reply-set since it's now done.
        log('loaded comments for ', self[0]);
        notify('stats.stale');
        if ( $('.load-comments:visible').length == 0) {  // last step is fetching the replies, so if there are no more to get, we're done with all the XHR fetching
          notify('replies.fetched');
        }
      }
    });
  }).click();                                           // Trigger fetching of all unfetched (hidden/collapsed) replies.
}

function getPager() {
  return $('#yt-comments-paginator');
}

function fetchMore() {
  state = 'fetching';
  getPager().click();
}

function invertOrder() {                               // Invert the order of the comments. Replies are already in a sane order (chronoligical)
  var comments = $('.comment-entry');
  comments.parent().first().append( comments.get().reverse() );
}

function getTotalCommentCount() {
  var m = $('.all-comments > a').text().trim().match(/\(([,.\d]+)\)/);
  if(m) return parseInt(m[1].replace(/[.,]/g,''),10);
  log('Error: Failed to find total number of comments');  
}

function getFetchedCommentCount() {
  return $('.comment-item').length;
}

function addListeners() {
  var pager = getPager();
  
  $('#b-fetchall').click(function() {
    $(this).hide();
    notify('stats.stale');
    fetchMore();
  });
  
  $('#b-sort').click(invertOrder);
  
  if(!pager.is(':visible')) notify('all.fetched');                // If there are to few comments to warrant a pager, there's nothing to fetch, so we're done.
   
  onAttributeChange(pager[0], function() {                        // else, there are more comments to fetch.
    if(state != 'fetching') return;                               // Only act if the paginated fetching was started using the script's button, not by user clicking "Show more".
    if(!pager.is(':visible')) notify('all.fetched');              // We've fetched all comments.
    else if(!pager.hasClass('activated')) notify('page.fetched'); // Google removes this class when it has injected additional comments.
    else notify('fetching.page');                                 // Pager is visible and has the activated class, so it's currently fetching a comment page.
  });

  on('page.fetched', function(){
    notify('stats.stale');
    fetchMore();
  });
  on('all.fetched', function() {
    log('all fetched');
    notify('stats.stale');
    fetchReplies();
  });
  on('fetching.page', function() {
    log('fetching page');
  });
  on('stats.stale', function() {
    updateProgress(getFetchedCommentCount(), getTotalCommentCount());
  });
  on('replies.fetched', hideProgress);
}

//==============================================
// Helpers
//==============================================

function log() {
  return;
  if(typeof(console) != 'undefined' && console.debug) {
    var stamp = (new Date()).toLocaleString().split(' ').pop(),
        args  = Array.prototype.slice.call(arguments);
    console.debug.apply(this,[stamp].concat(args));
  }
}

function addUI() {
  $('<style type="text/css">'+
    ' #c-fetchall { display:inline; margin-left:0.2em; }'+
    ' #c-fetchall button { margin-left:0.2em; }'+
    ' #f-progress { border:1px solid black; display:inline-block; height:1.5em; margin-left:0.2em; margin-top:0.25em; position:absolute; width:4.8em; }'+
    ' #f-percent  { left:34%; padding-top:0.25em; position:absolute; }'+
    ' #f-bar      { height:1.5em; background-color:#99ff99; width:50%; }'+
    '</style>').appendTo('body');

  $('<div id="c-fetchall">').insertAfter('#yt-comments-order-button');
  
  $('<button id="b-sort" class="yt-uix-button yt-uix-button-default" title="Reverse the comment sorting order"><span>Reverse</span></button>')
  .appendTo('#c-fetchall');
  
  $('<button id="b-fetchall" class="yt-uix-button yt-uix-button-default" title="Fetch all comments and replies"><span>Fetch all</span></button>')
  .appendTo('#c-fetchall');
  
  $('<div id="f-progress" style="display:none"><span id="f-percent">50%</span><div id="f-bar"></div></div>')
  .appendTo('#c-fetchall');
}

function onAttributeChange(el,cb) {
  var MutationObserver = window.MutationObserver || window.WebKitMutationObserver,
      observer = new MutationObserver(cb);
  observer.observe(el, {
    attributes: true
  });
  return observer;
}

function notify(eventName) { $(document.body).trigger(eventName); }
function on(eventName, cb) { $(document.body).on(eventName, cb); }

//==============================================
// Bootstrap
//==============================================
function onReady(cb) {
  var i = setInterval(function() {
    if( $(anchorFilter)[0] ) {
      clearInterval(i);
      cb();
    }
  },100);
}

onReady(function() {
  log('yt enhancement initializing');
  addUI();
  log('ui added');
  addListeners();
  log('yt enhancement initialized');
});



