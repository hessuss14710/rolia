import React, { useState, useEffect } from 'react';
import api from '../services/api';
import ItemCard from './ItemCard';
import { formatPrice, sortItems, filterItemsByType, getRarityStyle } from '../utils/itemUtils';

const ITEM_TYPES = [
  { key: 'all', label: 'Todos', icon: '📦' },
  { key: 'weapon', label: 'Armas', icon: '⚔️' },
  { key: 'armor', label: 'Armadura', icon: '🛡️' },
  { key: 'accessory', label: 'Accesorios', icon: '💍' },
  { key: 'consumable', label: 'Consumibles', icon: '🧪' },
  { key: 'misc', label: 'Otros', icon: '📦' }
];

export default function ShopModal({ shopCode, characterId, gold, onClose, onGoldChange, onInventoryChange }) {
  const [shop, setShop] = useState(null);
  const [shopInventory, setShopInventory] = useState([]);
  const [playerInventory, setPlayerInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('buy');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadShopData();
  }, [shopCode, characterId]);

  async function loadShopData() {
    try {
      setLoading(true);
      const [shopData, invData] = await Promise.all([
        api.getShop(shopCode),
        api.getCharacterInventory(characterId)
      ]);

      setShop(shopData.shop);
      setShopInventory(shopData.inventory);
      setPlayerInventory(invData.inventory);
    } catch (err) {
      console.error('Error loading shop:', err);
      setMessage({ type: 'error', text: 'Error al cargar tienda' });
    } finally {
      setLoading(false);
    }
  }

  async function handleBuy() {
    if (!selectedItem || processing) return;

    const totalCost = selectedItem.buy_price * quantity;
    if (totalCost > gold) {
      setMessage({ type: 'error', text: 'Oro insuficiente' });
      return;
    }

    try {
      setProcessing(true);
      const result = await api.buyItem(shopCode, characterId, selectedItem.id, quantity);

      setMessage({ type: 'success', text: result.message });
      onGoldChange(result.newGold);
      onInventoryChange();

      // Recargar inventarios
      const invData = await api.getCharacterInventory(characterId);
      setPlayerInventory(invData.inventory);

      // Actualizar stock de tienda si no es ilimitado
      if (selectedItem.stock !== -1) {
        setShopInventory(prev => prev.map(item =>
          item.id === selectedItem.id
            ? { ...item, stock: item.stock - quantity }
            : item
        ).filter(item => item.stock === -1 || item.stock > 0));
      }

      setSelectedItem(null);
      setQuantity(1);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setProcessing(false);
    }
  }

  async function handleSell() {
    if (!selectedItem || processing) return;

    const maxQty = playerInventory.find(i => i.item_id === selectedItem.item_id)?.quantity || 0;
    if (quantity > maxQty) {
      setMessage({ type: 'error', text: 'No tienes suficientes' });
      return;
    }

    try {
      setProcessing(true);
      const result = await api.sellItem(shopCode, characterId, selectedItem.item_id, quantity);

      setMessage({ type: 'success', text: result.message });
      onGoldChange(result.newGold);
      onInventoryChange();

      // Recargar inventario del jugador
      const invData = await api.getCharacterInventory(characterId);
      setPlayerInventory(invData.inventory);

      setSelectedItem(null);
      setQuantity(1);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setProcessing(false);
    }
  }

  // Filtrar items segun tab y tipo
  const displayItems = activeTab === 'buy'
    ? filterItemsByType(sortItems(shopInventory), selectedType)
    : filterItemsByType(sortItems(playerInventory), selectedType);

  // Calcular precio segun tab
  const getPrice = (item) => {
    if (activeTab === 'buy') {
      return item.buy_price;
    }
    // Para vender, calcular con el multiplicador de la tienda
    return Math.floor(item.base_price * (shop?.sell_multiplier || 0.5));
  };

  // Limpiar mensaje despues de 3 segundos
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (loading) {
    return (
      <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50">
        <div className="glass rounded-3xl p-8">
          <div className="spinner-large mx-auto" />
          <p className="text-gray-400 mt-4">Cargando tienda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 modal-overlay flex items-end sm:items-center justify-center z-50">
      <div className="glass rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="p-5 border-b border-white/10 shrink-0 bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500/30 to-orange-500/30 border border-yellow-500/50 flex items-center justify-center text-3xl">
                {shop?.icon_emoji || '🏪'}
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">{shop?.name}</h2>
                <div className="text-sm text-gray-400">{shop?.npc_name}</div>
              </div>
            </div>

            {/* Gold display */}
            <div className="flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-xl border border-yellow-500/30">
              <span className="text-2xl gold-display">🪙</span>
              <span className="text-xl font-bold text-yellow-400">{formatPrice(gold)}</span>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Descripcion */}
          {shop?.description && (
            <p className="text-sm text-gray-400 mt-3 italic">{shop.description}</p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 shrink-0">
          <button
            onClick={() => { setActiveTab('buy'); setSelectedItem(null); setQuantity(1); }}
            className={`flex-1 py-3 font-display font-bold text-sm transition-colors
              ${activeTab === 'buy'
                ? 'text-neon-green border-b-2 border-neon-green bg-neon-green/10'
                : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            🛒 Comprar
          </button>
          <button
            onClick={() => { setActiveTab('sell'); setSelectedItem(null); setQuantity(1); }}
            className={`flex-1 py-3 font-display font-bold text-sm transition-colors
              ${activeTab === 'sell'
                ? 'text-yellow-400 border-b-2 border-yellow-400 bg-yellow-400/10'
                : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            💰 Vender
          </button>
        </div>

        {/* Filtros de tipo */}
        <div className="flex gap-2 p-3 overflow-x-auto shrink-0 bg-white/5">
          {ITEM_TYPES.map(type => (
            <button
              key={type.key}
              onClick={() => setSelectedType(type.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all
                ${selectedType === type.key
                  ? 'bg-neon-purple text-white'
                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
                }`}
            >
              {type.icon} {type.label}
            </button>
          ))}
        </div>

        {/* Mensaje de estado */}
        {message && (
          <div className={`mx-4 mt-4 p-3 rounded-xl text-sm font-medium animate-fade-in
            ${message.type === 'success' ? 'bg-neon-green/20 text-neon-green' : 'bg-red-500/20 text-red-400'}`}
          >
            {message.text}
          </div>
        )}

        {/* Lista de items */}
        <div className="flex-1 overflow-y-auto p-4">
          {displayItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-2 opacity-50">📦</div>
              <p className="text-gray-500">
                {activeTab === 'buy' ? 'No hay items disponibles' : 'No tienes items para vender'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {displayItems.map((item) => (
                <ItemCard
                  key={item.id || item.item_id}
                  item={item}
                  quantity={activeTab === 'sell' ? item.quantity : undefined}
                  showPrice={true}
                  buyPrice={activeTab === 'buy' ? item.buy_price : null}
                  sellPrice={activeTab === 'sell' ? getPrice(item) : null}
                  selected={selectedItem?.id === item.id || selectedItem?.item_id === item.item_id}
                  onClick={() => {
                    setSelectedItem(item);
                    setQuantity(1);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Panel de compra/venta */}
        {selectedItem && (
          <div className="p-4 border-t border-white/10 bg-white/5 shrink-0">
            <div className="flex items-center gap-4">
              {/* Info del item seleccionado */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{selectedItem.icon_emoji}</span>
                  <span className={`font-bold ${getRarityStyle(selectedItem.rarity).text}`}>
                    {selectedItem.name}
                  </span>
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  Precio unitario: <span className="text-yellow-400">🪙 {formatPrice(getPrice(selectedItem))}</span>
                </div>
              </div>

              {/* Selector de cantidad */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
                >
                  -
                </button>
                <span className="w-12 text-center font-bold text-lg">{quantity}</span>
                <button
                  onClick={() => {
                    const maxQty = activeTab === 'sell'
                      ? selectedItem.quantity
                      : Math.floor(gold / getPrice(selectedItem));
                    setQuantity(Math.min(maxQty, quantity + 1));
                  }}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
                >
                  +
                </button>
              </div>

              {/* Total y boton */}
              <div className="text-right">
                <div className="text-sm text-gray-400">Total</div>
                <div className="text-xl font-bold text-yellow-400">
                  🪙 {formatPrice(getPrice(selectedItem) * quantity)}
                </div>
              </div>

              <button
                onClick={activeTab === 'buy' ? handleBuy : handleSell}
                disabled={processing || (activeTab === 'buy' && getPrice(selectedItem) * quantity > gold)}
                className={`px-6 py-3 rounded-xl font-display font-bold transition-all
                  ${activeTab === 'buy'
                    ? 'bg-gradient-to-r from-neon-green to-emerald-500 hover:shadow-lg hover:shadow-neon-green/30'
                    : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:shadow-lg hover:shadow-yellow-500/30'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {processing ? (
                  <span className="spinner w-5 h-5" />
                ) : activeTab === 'buy' ? (
                  'Comprar'
                ) : (
                  'Vender'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
