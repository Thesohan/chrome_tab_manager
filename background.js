class LRUCache {

  constructor(capacity) {
      this.cache = new Map();
      this.capacity = capacity;
      console.log("CACHE SIZE ",capacity)
    }

  get(key) {

    console.log("GET",key,this.cache)
    if (!this.cache.has(key)) return -1;

    const v = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, v);
    return this.cache.get(key);

  }

  put(key, value) {
    console.log("put",key,this.cache)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    this.cache.set(key, value);
    if (this.cache.size > this.capacity) {
      console.log(this.cache.keys().next().value)
      const keyToBeDeleted = this.cache.keys().next().value;
      console.log(keyToBeDeleted)
      this.cache.delete(keyToBeDeleted);  // keys().next().value returns first item's key
      return keyToBeDeleted
    }
    return undefined;
  }

  delete(key) {
    this.cache.delete(key)
  }

  // Serialize cache to array for storage
  serialize() {
    return Array.from(this.cache.entries());
  }

  // Deserialize cache from array
  deserialize(entries) {
    this.cache.clear();
    if (Array.isArray(entries)) {
      entries.forEach(([key, value]) => {
        this.cache.set(key, value);
      });
    }
  }

  // Get cache size
  size() {
    return this.cache.size;
  }

  // Peek at a value without modifying LRU order (for inspection only)
  peek(key) {
    if (!this.cache.has(key)) return -1;
    return this.cache.get(key);
  }

  // Check if key exists without modifying LRU order
  has(key) {
    return this.cache.has(key);
  }
}

const MAX_OPEN_TABS = 10;
const CACHE_STORAGE_KEY = 'tabCacheState';
let obj = new LRUCache(MAX_OPEN_TABS);
let isInitialized = false;

// Save cache state to storage
async function saveCacheState() {
  try {
    const cacheData = obj.serialize();
    await chrome.storage.local.set({ [CACHE_STORAGE_KEY]: cacheData });
    console.log("Cache state saved", cacheData);
  } catch (error) {
    console.error("Error saving cache state:", error);
  }
}

// Load cache state from storage
async function loadCacheState() {
  try {
    const result = await chrome.storage.local.get(CACHE_STORAGE_KEY);
    if (result[CACHE_STORAGE_KEY]) {
      obj.deserialize(result[CACHE_STORAGE_KEY]);
      console.log("Cache state loaded", obj.serialize());
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error loading cache state:", error);
    return false;
  }
}

// Enforce tab limit by closing excess tabs
async function enforceTabLimit() {
  try {
    const tabs = await chrome.tabs.query({});
    const currentTabCount = tabs.length;

    if (currentTabCount <= MAX_OPEN_TABS) {
      return; // No action needed
    }

    console.log(`Enforcing limit: ${currentTabCount} tabs open, max is ${MAX_OPEN_TABS}`);

    // Get all tab IDs and their last access times from cache
    // Use peek() to avoid modifying LRU order during enforcement
    const tabAccessTimes = new Map();
    const uncachedTabs = [];

    tabs.forEach(tab => {
      if (tab.id) {
        // Peek at cache if exists
        const cachedTime = obj.peek(tab.id);
        if (cachedTime !== -1) {
          tabAccessTimes.set(tab.id, cachedTime);
        } else {
          // Track uncached tabs separately
          uncachedTabs.push(tab.id);
        }
      }
    });

    // Sort cached tabs by access time (oldest first)
    const sortedCachedTabs = Array.from(tabAccessTimes.entries())
      .sort((a, b) => a[1] - b[1]);

    // Combine: cached tabs (oldest first) + uncached tabs
    const sortedTabs = sortedCachedTabs.map(([tabId]) => tabId).concat(uncachedTabs);

    // Calculate how many tabs to close
    const tabsToClose = currentTabCount - MAX_OPEN_TABS;
    const tabIdsToClose = sortedTabs.slice(0, tabsToClose);

    // Close excess tabs
    for (const tabId of tabIdsToClose) {
      try {
        await chrome.tabs.remove(tabId);
        obj.delete(tabId);
        console.log(`Closed excess tab: ${tabId}`);
      } catch (error) {
        console.log(`Error closing tab ${tabId}:`, error);
      }
    }

    // Update cache with remaining tabs (add any that aren't in cache)
    tabs.forEach(tab => {
      if (tab.id && !tabIdsToClose.includes(tab.id)) {
        if (!obj.has(tab.id)) {
          // Tab not in cache, add it
          obj.put(tab.id, Date.now());
        }
      }
    });

    await saveCacheState();
  } catch (error) {
    console.error("Error enforcing tab limit:", error);
  }
}

// Initialize cache with existing tabs (runs once on startup)
async function initializeCache() {
  if (isInitialized) {
    return;
  }

  try {
    // Try to load from storage first
    const loaded = await loadCacheState();

    // Query all existing tabs
    const tabs = await chrome.tabs.query({});
    console.log("Initializing cache with tabs:", tabs);

    // If cache was loaded from storage, verify tabs still exist
    if (loaded) {
      // Remove any cached tab IDs that no longer exist
      const existingTabIds = new Set(tabs.map(tab => tab.id));
      const cacheEntries = obj.serialize();
      cacheEntries.forEach(([tabId]) => {
        if (!existingTabIds.has(tabId)) {
          obj.delete(tabId);
        }
      });

      // Update cache with current tabs (update access times for existing, add new ones)
      tabs.forEach(tab => {
        if (tab.id) {
          const cachedTime = obj.get(tab.id);
          if (cachedTime === -1) {
            // Tab not in cache, add it
            obj.put(tab.id, Date.now());
          }
        }
      });
    } else {
      // Fresh initialization: populate cache with all existing tabs
      tabs.forEach(tab => {
        if (tab.id) {
          obj.put(tab.id, Date.now());
        }
      });
    }

    // Enforce tab limit if there are too many tabs
    await enforceTabLimit();

    // Save the initialized state
    await saveCacheState();
    isInitialized = true;
    console.log("Cache initialized, size:", obj.size());
  } catch (error) {
    console.error("Error initializing cache:", error);
    isInitialized = true; // Set to true to prevent retry loops
  }
}

// Handle tab activation - update LRU cache
async function handleTabActivated(activeInfo) {
  try {
    const tabId = activeInfo.tabId;
    console.log("on activated", tabId);

    // Update cache with activated tab
    const keyToBeDeleted = obj.put(tabId, Date.now());

    if (keyToBeDeleted !== undefined) {
      console.log("key to be deleted", keyToBeDeleted);
      try {
        await chrome.tabs.remove(keyToBeDeleted);
      } catch (error) {
        // Tab might already be closed, ignore error
        console.log("Tab already closed or error removing tab:", error);
      }
    }

    // Enforce limit after activation to catch any edge cases
    await enforceTabLimit();
    await saveCacheState();
  } catch (error) {
    console.error("Error handling tab activation:", error);
  }
}

// Handle tab creation - track immediately and enforce limit
async function handleTabCreated(tab) {
  try {
    if (!tab.id) return;

    console.log("on created", tab.id);

    // Add to cache
    const keyToBeDeleted = obj.put(tab.id, Date.now());

    if (keyToBeDeleted !== undefined) {
      console.log("key to be deleted on creation", keyToBeDeleted);
      try {
        await chrome.tabs.remove(keyToBeDeleted);
      } catch (error) {
        // Tab might already be closed, ignore error
        console.log("Tab already closed or error removing tab:", error);
      }
    }

    // Always enforce limit after tab creation to ensure we never exceed MAX_OPEN_TABS
    await enforceTabLimit();
    await saveCacheState();
  } catch (error) {
    console.error("Error handling tab creation:", error);
  }
}

// Handle tab removal - remove from cache
async function handleTabRemoved(tabId) {
  try {
    console.log("on removed", tabId);
    obj.delete(tabId);
    await saveCacheState();
  } catch (error) {
    console.error("Error handling tab removal:", error);
  }
}

// Periodic enforcement check (every 5 seconds) to catch any edge cases
setInterval(async () => {
  if (isInitialized) {
    await enforceTabLimit();
  }
}, 5000);

// Initialize on service worker startup
initializeCache();

// Register event listeners at top level (not inside onInstalled)
chrome.tabs.onActivated.addListener(handleTabActivated);
chrome.tabs.onCreated.addListener(handleTabCreated);
chrome.tabs.onRemoved.addListener(handleTabRemoved);

// Handle extension installation/update
chrome.runtime.onInstalled.addListener(() => {
  // Re-initialize cache on install/update
  isInitialized = false;
  initializeCache();
});
