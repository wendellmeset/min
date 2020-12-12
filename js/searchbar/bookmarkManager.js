const searchbar = require('searchbar/searchbar.js')
const searchbarPlugins = require('searchbar/searchbarPlugins.js')
const searchbarUtils = require('searchbar/searchbarUtils.js')
const bangsPlugin = require('searchbar/bangsPlugin.js')
const places = require('places/places.js')
const urlParser = require('util/urlParser.js')
const formatRelativeDate = require('util/relativeDate.js')

const tabEditor = require('navbar/tabEditor.js')
const bookmarkEditor = require('searchbar/bookmarkEditor.js')

const maxTagSuggestions = 12

function parseBookmarkSearch (text) {
  const tags = text.split(/\s/g).filter(function (word) {
    return word.startsWith('#') && word.length > 1
  }).map(t => t.substring(1))

  let newText = text
  tags.forEach(function (word) {
    newText = newText.replace('#' + word, '')
  })
  newText = newText.trim()
  return {
    tags,
    text: newText
  }
}

function itemMatchesTags (item, tags) {
  for (var i = 0; i < tags.length; i++) {
    if (!item.tags.filter(t => t.startsWith(tags[i])).length) {
      return false
    }
  }
  return true
}

function showBookmarkEditor (url, item) {
  bookmarkEditor.show(url, item, function (newBookmark) {
    if (newBookmark) {
      if (item.parentNode) {
        // item could be detached from the DOM if the searchbar is closed
        item.parentNode.replaceChild(getBookmarkListItem(newBookmark), item)
      }
    } else {
      places.deleteHistory(url)
      item.remove()
    }
  })
}

function getBookmarkListItem (result, focus) {
  var item = searchbarUtils.createItem({
    title: result.title,
    icon: 'carbon:star-filled',
    secondaryText: urlParser.getSourceURL(result.url),
    fakeFocus: focus,
    click: function (e) {
      searchbar.openURL(result.url, e)
    },
    classList: ['bookmark-item'],
    delete: function () {
      places.deleteHistory(result.url)
    },
    button: {
      icon: 'carbon:edit',
      fn: function (el) {
        showBookmarkEditor(result.url, item)
      }
    }
  })
  return item
}

const bookmarkManager = {
  showBookmarks: function (text, input, event) {
    const container = searchbarPlugins.getContainer('bangs')

    const parsedText = parseBookmarkSearch(text)

    const displayedURLset = []
    places.searchPlaces(parsedText.text, function (results) {
      places.autocompleteTags(parsedText.tags, function (suggestedTags) {
        searchbarPlugins.reset('bangs')

        const tagBar = document.createElement('div')
        tagBar.id = 'bookmark-tag-bar'
        container.appendChild(tagBar)

        parsedText.tags.forEach(function (tag) {
          tagBar.appendChild(bookmarkEditor.getTagElement(tag, true, function () {
            tabEditor.show(tabs.getSelected(), '!bookmarks ' + text.replace('#' + tag, '').trim())
          }, { autoRemove: false }))
        })
        // it doesn't make sense to display tag suggestions if there's a search, since the suggestions are generated without taking the search into account
        if (!parsedText.text) {
          suggestedTags.forEach(function (suggestion, index) {
            const el = bookmarkEditor.getTagElement(suggestion, false, function () {
              const needsSpace = text.slice(-1) !== ' ' && text.slice(-1) !== ''
              tabEditor.show(tabs.getSelected(), '!bookmarks ' + text + (needsSpace ? ' #' : '#') + suggestion + ' ')
            })
            if (index >= maxTagSuggestions) {
              el.classList.add('overflowing')
            }
            tagBar.appendChild(el)
          })

          if (suggestedTags.length > maxTagSuggestions) {
            var expandEl = bookmarkEditor.getTagElement('\u2026', false, function () {
              tagBar.classList.add('expanded')
              expandEl.remove()
            })
            tagBar.appendChild(expandEl)
          }
        }

        let lastRelativeDate = '' // used to generate headings

        results
          .filter(function (result) {
            if (itemMatchesTags(result, parsedText.tags)) {
              return true
            } else {
              return false
            }
          })
          .sort(function (a, b) {
            // order by last visit
            return b.lastVisit - a.lastVisit
          })
          .slice(0, 100)
          .forEach(function (result, index) {
            displayedURLset.push(result.url)

            const thisRelativeDate = formatRelativeDate(result.lastVisit)
            if (thisRelativeDate !== lastRelativeDate) {
              searchbarPlugins.addHeading('bangs', { text: thisRelativeDate })
              lastRelativeDate = thisRelativeDate
            }
            const item = getBookmarkListItem(result, index === 0 && parsedText.text)
            container.appendChild(item)
          })

        if (text === '' && results.length < 3) {
          container.appendChild(searchbarUtils.createItem({
            title: l('importBookmarks'),
            icon: 'carbon:upload',
            click: function () {
              searchbar.openURL('!importbookmarks', null)
            }
          }))
        }

        if (parsedText.tags.length > 0) {
          places.getSuggestedItemsForTags(parsedText.tags, function (suggestedResults) {
            suggestedResults = suggestedResults.filter(res => !displayedURLset.includes(res.url))
            if (suggestedResults.length === 0) {
              return
            }
            searchbarPlugins.addHeading('bangs', { text: l('bookmarksSimilarItems') })
            suggestedResults.sort(function (a, b) {
              // order by last visit
              return b.lastVisit - a.lastVisit
            }).forEach(function (result, index) {
              const item = getBookmarkListItem(result, false)
              container.appendChild(item)
            })
          })
        }
      })
    }, {
      searchBookmarks: true,
      limit: Infinity
    })
  },
  initialize: function () {
    bangsPlugin.registerCustomBang({
      phrase: '!bookmarks',
      snippet: l('searchBookmarks'),
      isAction: false,
      showSuggestions: bookmarkManager.showBookmarks,
      fn: function (text) {
        const parsedText = parseBookmarkSearch(text)
        if (!parsedText.text) {
          return
        }
        places.searchPlaces(parsedText.text, function (results) {
          results = results
            .filter(r => itemMatchesTags(r, parsedText.tags))
            .sort(function (a, b) {
              return b.lastVisit - a.lastVisit
            })
          if (results.length !== 0) {
            searchbar.openURL(results[0].url, null)
          }
        }, { searchBookmarks: true })
      }
    })
  }
}

module.exports = bookmarkManager
