// ==UserScript==
// @name        YouTube Comments Plus
// @namespace   jojje/gm
// @description Fetches all comments and allows for inverting the sorting order
// @require     https://code.jquery.com/jquery-3.1.1.min.js
// @include     https://www.youtube.com/watch?v=*
// @downloadURL https://raw.githubusercontent.com/jojje/ytc-plus/master/youtube_comments_plus.user.js
// @updateURL   https://raw.githubusercontent.com/jojje/ytc-plus/master/youtube_comments_plus.user.js
// @homepageURL https://github.com/jojje/ytc-plus
// @author      jojje
// @version     1.0.2
// @grant       none
// ==/UserScript==

(function($){
var anchorFilter = '.comment-section-sort-menu';
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

function sendClickEvent(el){
  var evt = document.createEvent('Events');
  evt.initEvent('click', true, false);
  el.dispatchEvent(evt);
}

function getAllLoadMoreButtons() {
  return $('.yt-uix-expander-collapsed > .yt-uix-expander-collapsed-body > button.yt-uix-load-more:visible');
}

function fetchReplies() {
  getAllLoadMoreButtons().each(function() {
    var self = $(this).closest('.yt-uix-expander-collapsed'), observer;

    observer = onAttributeChange(self[0], function() {  // Element changes class attribute when replies have been fetched
      if(!self.hasClass('.yt-uix-expander-collapsed')){ //  by removing the class.
        observer.disconnect();                          // Stop listening to this reply-set since it's now done.
        log('loaded comments for ', self[0]);
        notify('stats.stale');
        if ( getAllLoadMoreButtons().length === 0) {    // last step is fetching the replies, so if there are no more to get, we're done with all the XHR fetching
          observer.disconnect();
          notify('replies.fetched');
        }
      }
    });
  }).each(function() {
    sendClickEvent(this);                               // Trigger fetching of all unfetched (hidden/collapsed) replies.
  });
}

function getPager() {
  return $('.comment-section-renderer-paginator.load-more-button');
}

function isEnabled(el) {
  return el[0] && !el.prop('disabled');
}

function fetchMore() {
  state = 'fetching';
  sendClickEvent(getPager()[0]);
}

function isTopCommentsView() {
  return $('#comment-section-renderer-items > section').length > 0;
}

function invertOrder() {                               // Invert the order of the comments. Replies are already in a sane order (chronoligical)
  var filter = isTopCommentsView() ? 'section.comment-thread-renderer' : '.comment-renderer';
  var comments = $(filter);
  comments.parent().first().append( comments.get().reverse() );
}

function getTotalCommentCount() {
  var m = $('.comment-section-header-renderer').text().trim().match(/([,.\d]+)/);
  if(m) return parseInt(m[1].replace(/[.,]/g,''),10);
  log('Error: Failed to find total number of comments');
}

function getFetchedCommentCount() {
  return $('.comment-renderer').length;
}

function addListeners() {
  var discussion = $('#watch-discussion'), observer;

  $('#b-fetchall').click(function() {
    $(this).hide(function(){ $(this).remove(); });
    notify('stats.stale');
    fetchMore();
  });

  $('#b-sort').click(invertOrder);

  if(getPager()[0]) notify('all.fetched');                        // If there are to few comments to warrant a pager, there's nothing to fetch, so we're done.

  observer = onAttributeChange(discussion[0], function() {        // else, there are more comments to fetch.
    if(state != 'fetching') return;                               // Only act if the paginated fetching was started using the script's button, not by user clicking "Show more".
    var pager = getPager();

    if(!pager[0]) {                                               // We've fetched all comments when the pager is gone.
      observer.disconnect();
      notify('all.fetched');
    } else if(!isEnabled(pager)) {                                // Google disables the pager during fetching of next page.
      notify('fetching.page');
    } else {                                                      // Pager is visible and has the activated class, so it's currently fetching a comment page.
      notify('page.fetched');
    }
  }, true);

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
  // return;
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

  $('<div id="c-fetchall">').insertAfter(anchorFilter);

  $('<button id="b-sort" class="yt-uix-button yt-uix-button-default" title="Reverse the comment sorting order"><span>Reverse</span></button>')
  .appendTo('#c-fetchall');

  $('<button id="b-fetchall" class="yt-uix-button yt-uix-button-default" title="Fetch all comments and replies"><span>Fetch all</span></button>')
  .appendTo('#c-fetchall');

  $('<div id="f-progress" style="display:none"><span id="f-percent">50%</span><div id="f-bar"></div></div>')
  .appendTo('#c-fetchall');
}

// If chidren is truthy, monitors subtree child node additions and removal, else attribute modification directly on the provided 'el'ement.
function onAttributeChange(el, cb, children) {
  var MutationObserver = window.MutationObserver || window.WebKitMutationObserver,
      observer = new MutationObserver(cb);
  observer.observe(el, {
    attributes: !children,
    childList: !!children,
    subtree: !!children,
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

})($);
$.noConflict();
