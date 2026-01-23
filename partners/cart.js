/**
 * Moonshot Cart Module
 * Handles cart state via localStorage
 */

const CART_KEY = 'moonshot_cart';
const CART_SLUG_KEY = 'moonshot_cart_slug';

const MoonshotCart = {
  // Get current cart items
  getItems() {
    try {
      const data = localStorage.getItem(CART_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // Get the partner slug associated with cart
  getSlug() {
    return localStorage.getItem(CART_SLUG_KEY) || '';
  },

  // Set partner slug
  setSlug(slug) {
    localStorage.setItem(CART_SLUG_KEY, slug);
  },

  // Save cart items
  saveItems(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    this.notifyListeners();
  },

  // Add item to cart
  addItem(product) {
    const items = this.getItems();
    const existing = items.find(item => item.id === product.id);

    if (existing) {
      existing.quantity += 1;
    } else {
      items.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: 1
      });
    }

    this.saveItems(items);
    return items;
  },

  // Remove item from cart
  removeItem(productId) {
    const items = this.getItems().filter(item => item.id !== productId);
    this.saveItems(items);
    return items;
  },

  // Update item quantity
  updateQuantity(productId, quantity) {
    const items = this.getItems();
    const item = items.find(i => i.id === productId);

    if (item) {
      if (quantity <= 0) {
        return this.removeItem(productId);
      }
      item.quantity = quantity;
      this.saveItems(items);
    }

    return items;
  },

  // Get total item count
  getItemCount() {
    return this.getItems().reduce((sum, item) => sum + item.quantity, 0);
  },

  // Get cart total in dollars
  getTotal() {
    return this.getItems().reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },

  // Clear cart
  clear() {
    localStorage.removeItem(CART_KEY);
    this.notifyListeners();
  },

  // Listener management for UI updates
  _listeners: [],

  addListener(fn) {
    this._listeners.push(fn);
  },

  removeListener(fn) {
    this._listeners = this._listeners.filter(l => l !== fn);
  },

  notifyListeners() {
    this._listeners.forEach(fn => fn(this.getItems()));
  }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MoonshotCart;
}
