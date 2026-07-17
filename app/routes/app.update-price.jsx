// app/routes/app.update-price.jsx

import { useLoaderData, useFetcher } from "react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Page, Layout, Card, Text, Button, Modal, TextField, FormLayout,
  Toast, Frame, Grid, BlockStack, InlineStack, Badge, IndexTable,
  Icon, Divider, Pagination, Select, RadioButton, Banner, Spinner,
} from "@shopify/polaris";
import {
  EditIcon, AlertCircleIcon, CheckIcon, ComposeIcon, SettingsIcon,
  SearchIcon, ChevronDownIcon, ChevronUpIcon,
} from "@shopify/polaris-icons";
import shopify from "../shopify.server";
import {
  calculatePriceFromRate, summarizeSelectedCollections,
  parseWeightFromOptions, parseWeightFromMetafieldValue,
} from "../utils/jewelry-pricing";

export const meta = () => [{ title: "Jewelry Price Manager" }];

// ─── Theme Helpers ─────────────────────────────────────────────────────────────
function getThemeStyles(title) {
  const t = title.toLowerCase();
  const base = {
    padding: "16px", borderRadius: "16px", border: "1px solid #e5e7eb",
    cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)", height: "100%", position: "relative",
  };
  if (t.includes("24k") || t.includes("gold"))
    return { ...base, background: "#fef3c7", borderColor: "#fbbf24", color: "#451a03" };
  if (t.includes("silver") || t.includes("925"))
    return { ...base, background: "#f3f4f6", borderColor: "#d4d4d8", color: "#1f2937" };
  if (t.includes("platinum") || t.includes("pt"))
    return { ...base, background: "#e5e7eb", borderColor: "#cbd5f5", color: "#1e1b4b" };
  if (t.includes("diamond"))
    return { ...base, background: "#e0f2fe", borderColor: "#93c5fd", color: "#0c4a6e" };
  return { ...base, background: "#fef9c3", borderColor: "#e5e7eb", color: "#111827" };
}

function getMetafieldTypeColor(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("number") || t.includes("integer") || t.includes("decimal")) return "#16a34a";
  if (t.includes("weight") || t.includes("measurement")) return "#2563eb";
  if (t.includes("string") || t.includes("single_line")) return "#9333ea";
  if (t.includes("json")) return "#ea580c";
  return "#6b7280";
}

function getMetafieldTypeIcon(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("number") || t.includes("integer") || t.includes("decimal")) return "#";
  if (t.includes("weight") || t.includes("measurement")) return "⚖";
  if (t.includes("string") || t.includes("single_line")) return "Aa";
  if (t.includes("json")) return "{ }";
  return "◆";
}

// ─── Metafield Picker Component ────────────────────────────────────────────────
function MetafieldPicker({ metafieldDefinitions, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [isOpen]);

  const selectedDef = useMemo(
    () => metafieldDefinitions.find((d) => `${d.namespace}.${d.key}` === value),
    [value, metafieldDefinitions]
  );

  const { variantDefs, productDefs } = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filter = (d) => {
      if (!q) return true;
      return d.name.toLowerCase().includes(q) || d.namespace.toLowerCase().includes(q) ||
        d.key.toLowerCase().includes(q) || (d.type || "").toLowerCase().includes(q) ||
        (d.description || "").toLowerCase().includes(q);
    };
    return {
      variantDefs: metafieldDefinitions.filter((d) => d.ownerType === "PRODUCTVARIANT" && filter(d)),
      productDefs: metafieldDefinitions.filter((d) => d.ownerType === "PRODUCT" && filter(d)),
    };
  }, [metafieldDefinitions, search]);

  const totalResults = variantDefs.length + productDefs.length;
  const handleSelect = (fullKey) => { onChange(fullKey); setIsOpen(false); setSearch(""); };
  const handleToggle = () => { setIsOpen((prev) => !prev); if (isOpen) setSearch(""); };

  const renderRow = (d) => {
    const fullKey = `${d.namespace}.${d.key}`;
    const isSelected = value === fullKey;
    return (
      <div key={d.id} role="option" aria-selected={isSelected} tabIndex={0}
        onClick={() => handleSelect(fullKey)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleSelect(fullKey)}
        style={{
          display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px",
          cursor: "pointer", background: isSelected ? "#f0f7ff" : "transparent",
          borderBottom: "1px solid #f5f5f5", transition: "background 0.1s ease",
        }}
        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#f8f9fa"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? "#f0f7ff" : "transparent"; }}
      >
        <div style={{
          width: "34px", height: "34px", borderRadius: "8px",
          background: `${getMetafieldTypeColor(d.type)}12`,
          border: `1.5px solid ${getMetafieldTypeColor(d.type)}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "13px", fontWeight: "700", color: getMetafieldTypeColor(d.type), flexShrink: 0,
        }}>
          {getMetafieldTypeIcon(d.type)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: "600", fontSize: "13.5px", color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {d.name}
          </div>
          <div style={{ fontSize: "12px", color: "#8c9196", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {d.namespace}.{d.key}
            <span style={{ marginLeft: "6px", padding: "1px 5px", background: "#f3f4f6", borderRadius: "4px", fontSize: "10px", color: "#6b7280" }}>
              {d.type}
            </span>
          </div>
        </div>
        {isSelected && (
          <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div role="button" tabIndex={0} onClick={handleToggle}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleToggle()}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 12px", border: isOpen ? "2px solid #2563eb" : "1px solid #c9cccf",
          borderRadius: "8px", background: "#ffffff", cursor: "pointer",
          transition: "border-color 0.15s ease", minHeight: "44px",
        }}
      >
        {selectedDef ? (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
            <div style={{
              width: "32px", height: "32px", borderRadius: "8px",
              background: `${getMetafieldTypeColor(selectedDef.type)}15`,
              border: `1px solid ${getMetafieldTypeColor(selectedDef.type)}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "14px", fontWeight: "600", color: getMetafieldTypeColor(selectedDef.type), flexShrink: 0,
            }}>
              {getMetafieldTypeIcon(selectedDef.type)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: "600", fontSize: "13px", color: "#1a1a1a" }}>{selectedDef.name}</div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>{selectedDef.namespace}.{selectedDef.key}</div>
            </div>
            <Badge size="small" tone={selectedDef.ownerType === "PRODUCTVARIANT" ? "info" : "attention"}>
              {selectedDef.ownerType === "PRODUCTVARIANT" ? "Variant" : "Product"}
            </Badge>
          </div>
        ) : (
          <span style={{ color: "#8c9196", fontSize: "14px" }}>Select a metafield...</span>
        )}
        <div style={{ marginLeft: "8px", flexShrink: 0 }}>
          <Icon source={isOpen ? ChevronUpIcon : ChevronDownIcon} tone="subdued" />
        </div>
      </div>

      {isOpen && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 1000,
          background: "#ffffff", border: "1px solid #e1e3e5", borderRadius: "12px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden",
        }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #f0f0f0" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px",
              background: "#f7f7f8", borderRadius: "8px", border: "1px solid #e5e7eb",
            }}>
              <Icon source={SearchIcon} tone="subdued" />
              <input ref={searchInputRef} type="text" placeholder="Search metafields..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ border: "none", outline: "none", background: "transparent", fontSize: "14px", width: "100%", color: "#1a1a1a" }}
              />
              {search && (
                <button onClick={(e) => { e.stopPropagation(); setSearch(""); }}
                  style={{ border: "none", background: "#e5e7eb", borderRadius: "50%", width: "18px", height: "18px", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", flexShrink: 0 }}>
                  ✕
                </button>
              )}
            </div>
          </div>
          <div style={{ maxHeight: "320px", overflowY: "auto" }}>
            {totalResults === 0 && (
              <div style={{ padding: "24px", textAlign: "center", color: "#8c9196" }}>
                <div style={{ fontSize: "24px", marginBottom: "8px" }}>🔍</div>
                <div style={{ fontSize: "14px", fontWeight: "500" }}>No metafields found</div>
                <div style={{ fontSize: "12px", marginTop: "4px" }}>
                  {search ? "Try a different search term" : "Create metafields in Settings → Custom data"}
                </div>
              </div>
            )}
            {variantDefs.length > 0 && (
              <>
                <div style={{ padding: "8px 14px", background: "#f8f9fa", borderBottom: "1px solid #f0f0f0", borderTop: "1px solid #f0f0f0" }}>
                  <Text variant="bodySm" tone="subdued" fontWeight="semibold">VARIANT METAFIELDS</Text>
                </div>
                {variantDefs.map(renderRow)}
              </>
            )}
            {productDefs.length > 0 && (
              <>
                <div style={{ padding: "8px 14px", background: "#f8f9fa", borderBottom: "1px solid #f0f0f0", borderTop: "1px solid #f0f0f0" }}>
                  <Text variant="bodySm" tone="subdued" fontWeight="semibold">PRODUCT METAFIELDS</Text>
                </div>
                {productDefs.map(renderRow)}
              </>
            )}
          </div>
          {value && (
            <div style={{ padding: "8px 14px", borderTop: "1px solid #e5e7eb", background: "#fafafa", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={(e) => { e.stopPropagation(); onChange(""); setIsOpen(false); setSearch(""); }}
                style={{ border: "none", background: "transparent", color: "#dc2626", fontSize: "13px", cursor: "pointer", padding: "4px 8px", borderRadius: "6px" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Loader ────────────────────────────────────────────────────────────────────
export async function loader({ request }) {
  const { admin } = await shopify.authenticate.admin(request);

  const url = new URL(request.url);
  const weightSource = url.searchParams.get("weightSource") || "variant_option";
  const metafieldNamespace = url.searchParams.get("metafieldNamespace") || "";
  const metafieldKey = url.searchParams.get("metafieldKey") || "";
  const variantOptionName = url.searchParams.get("variantOptionName") || "";

  // 1. Fetch metafield definitions (Paginated)
  const ownerTypes = ["PRODUCT", "PRODUCTVARIANT"];
  const allMetafieldDefs = [];

  for (const ownerType of ownerTypes) {
    let hasNext = true;
    let cursor = null;
    while (hasNext) {
      const afterClause = cursor ? `, after: "${cursor}"` : "";
      try {
        const defsResponse = await admin.graphql(
          `#graphql
            query MetafieldDefinitions {
              metafieldDefinitions(first: 50, ownerType: ${ownerType}${afterClause}) {
                edges {
                  node { id name namespace key type { name } ownerType description }
                  cursor
                }
                pageInfo { hasNextPage }
              }
            }
          `
        );
        const defsBody = await defsResponse.json();
        const edges = defsBody.data?.metafieldDefinitions?.edges ?? [];
        const pageInfo = defsBody.data?.metafieldDefinitions?.pageInfo;
        edges.forEach(({ node, cursor: c }) => {
          allMetafieldDefs.push({
            id: node.id, name: node.name, namespace: node.namespace, key: node.key,
            type: node.type?.name || "unknown", ownerType: node.ownerType,
            description: node.description || "", fullKey: `${node.namespace}.${node.key}`,
          });
          cursor = c;
        });
        hasNext = pageInfo?.hasNextPage ?? false;
      } catch (err) {
        console.error(`Failed to fetch metafield definitions for ${ownerType}:`, err);
        hasNext = false;
      }
    }
  }

  // 2. Build Collections Data (Fully Paginated to bypass limits)
  const needsMetafield = weightSource === "metafield" &&
    metafieldNamespace && metafieldKey &&
    /^[a-zA-Z0-9_-]+$/.test(metafieldNamespace) &&
    /^[a-zA-Z0-9_-]+$/.test(metafieldKey);

  const allCollectionsMap = new Map();
  const allOptionNames = new Set();
  
  try {
    // --- Step A: Get all Collections limitlessly ---
    let colHasNext = true;
    let colCursor = null;

    while (colHasNext) {
      const colRes = await admin.graphql(
        `#graphql
        query getCollections($cursor: String) {
          collections(first: 250, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            edges { node { id title handle } }
          }
        }`,
        { variables: { cursor: colCursor } }
      );
      const colBody = await colRes.json();
      const cols = colBody.data?.collections;
      if (!cols) break;

      for (const edge of cols.edges) {
        allCollectionsMap.set(edge.node.id, {
          id: edge.node.id,
          title: edge.node.title,
          products: [] // we will push variants directly here
        });
      }
      colHasNext = cols.pageInfo.hasNextPage;
      colCursor = cols.pageInfo.endCursor;
    }

    // --- Step B: Get all Products and their Variants limitlessly ---
    let prodHasNext = true;
    let prodCursor = null;
    
    // Dynamically insert metafield query if needed
    const prodQuery = `#graphql
      query getAllProducts($cursor: String${needsMetafield ? ', $metafieldNamespace: String!, $metafieldKey: String!' : ''}) {
        products(first: 250, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id title handle status
              ${needsMetafield ? 'metafield(namespace: $metafieldNamespace, key: $metafieldKey) { value type }' : ''}
              collections(first: 100) { edges { node { id } } }
              variants(first: 100) {
                edges {
                  node {
                    id title price selectedOptions { name value }
                    ${needsMetafield ? 'metafield(namespace: $metafieldNamespace, key: $metafieldKey) { value type }' : ''}
                  }
                }
              }
            }
          }
        }
      }
    `;

    while (prodHasNext) {
      const variables = { cursor: prodCursor };
      if (needsMetafield) {
        variables.metafieldNamespace = metafieldNamespace;
        variables.metafieldKey = metafieldKey;
      }

      const prodRes = await admin.graphql(prodQuery, { variables });
      const prodBody = await prodRes.json();
      const prods = prodBody.data?.products;
      if (!prods) break;

      for (const edge of prods.edges) {
        const p = edge.node;
        const variants = p.variants?.edges ?? [];
        if (variants.length === 0) continue;

        // Map variants similarly to original code
        const mappedVariants = variants.map(({ node: v }) => {
          // Log option names globally
          v.selectedOptions?.forEach((opt) => {
            if (opt.name && opt.name.toLowerCase() !== "title") allOptionNames.add(opt.name);
          });

          const basePrice = Number(v?.price ?? 0);
          let weightValue = 0;
          
          if (weightSource === "metafield" && needsMetafield) {
            const metaVal = v?.metafield?.value || p?.metafield?.value || "0";
            weightValue = parseWeightFromMetafieldValue(metaVal);
          } else {
            weightValue = parseWeightFromOptions(v?.selectedOptions ?? [], variantOptionName);
          }

          return {
            id: `${p.id}::${v.id}`, 
            productId: p.id, 
            variantId: v.id,
            title: p.title, 
            variantTitle: v.title, 
            basePrice, 
            weightGrams: weightValue,
          };
        });

        // Insert variants into their assigned collections
        const pCollections = p.collections?.edges ?? [];
        for (const { node: c } of pCollections) {
          if (allCollectionsMap.has(c.id)) {
            allCollectionsMap.get(c.id).products.push(...mappedVariants);
          }
        }
      }
      prodHasNext = prods.pageInfo.hasNextPage;
      prodCursor = prods.pageInfo.endCursor;
    }
  } catch (err) {
    console.error("Failed to fetch products and collections:", err);
  }

  // Convert map back into an array to feed to your components
  const collections = Array.from(allCollectionsMap.values());

  return {
    collections,
    availableOptionNames: Array.from(allOptionNames).sort(),
    metafieldDefinitions: allMetafieldDefs,
    currentWeightConfig: { weightSource, metafieldNamespace, metafieldKey, variantOptionName },
  };
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function UpdatePrice() {
  const initialData = useLoaderData();
  const fetcher = useFetcher();
  const dataFetcher = useFetcher();

  // Resolved data
  const resolvedData = dataFetcher.data || initialData;
  const { collections, availableOptionNames, metafieldDefinitions, currentWeightConfig } = resolvedData;
  const isReloading = dataFetcher.state === "loading";

  // ── ALL state initialized with SAFE defaults (no localStorage in initializer) ──
  const [hydrated, setHydrated] = useState(false);
  const [weightSource, setWeightSource] = useState("variant_option");
  const [variantOptionName, setVariantOptionName] = useState("");
  const [metafieldNamespace, setMetafieldNamespace] = useState("");
  const [metafieldKey, setMetafieldKey] = useState("");
  const [unitLabel, setUnitLabel] = useState("g");
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionDone, setSelectionDone] = useState(false);
  const [pricing, setPricing] = useState({});
  const [modalCollectionId, setModalCollectionId] = useState(null);
  const [modalRate, setModalRate] = useState("0");
  const [modalPercent, setModalPercent] = useState("0");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [buttonStatus, setButtonStatus] = useState("idle");
  const [filterCollectionId, setFilterCollectionId] = useState("");
  const [weightConfigModalOpen, setWeightConfigModalOpen] = useState(false);
  const [tempWeightSource, setTempWeightSource] = useState("variant_option");
  const [tempVariantOptionName, setTempVariantOptionName] = useState("");
  const [tempMetafieldFullKey, setTempMetafieldFullKey] = useState("");
  const [tempUnitLabel, setTempUnitLabel] = useState("g");

  // ── Hydrate from localStorage ONCE on mount ──
  useEffect(() => {
    try {
      const savedConfig = JSON.parse(localStorage.getItem("jpm_weight_config") || "{}");
      if (savedConfig.weightSource) setWeightSource(savedConfig.weightSource);
      if (savedConfig.variantOptionName) setVariantOptionName(savedConfig.variantOptionName);
      if (savedConfig.metafieldNamespace) setMetafieldNamespace(savedConfig.metafieldNamespace);
      if (savedConfig.metafieldKey) setMetafieldKey(savedConfig.metafieldKey);

      const savedUnit = localStorage.getItem("jpm_unit_label");
      if (savedUnit) setUnitLabel(savedUnit);

      const savedPricing = JSON.parse(localStorage.getItem("jpm_pricing") || "{}");
      if (Object.keys(savedPricing).length > 0) setPricing(savedPricing);

      // Check if we need to reload with saved config
      if (savedConfig.weightSource && savedConfig.weightSource !== currentWeightConfig.weightSource ||
          savedConfig.metafieldNamespace && savedConfig.metafieldNamespace !== currentWeightConfig.metafieldNamespace ||
          savedConfig.metafieldKey && savedConfig.metafieldKey !== currentWeightConfig.metafieldKey ||
          savedConfig.variantOptionName && savedConfig.variantOptionName !== currentWeightConfig.variantOptionName) {
        const params = new URLSearchParams();
        params.set("weightSource", savedConfig.weightSource || "variant_option");
        if (savedConfig.weightSource === "variant_option") {
          params.set("variantOptionName", savedConfig.variantOptionName || "");
        } else if (savedConfig.weightSource === "metafield") {
          params.set("metafieldNamespace", savedConfig.metafieldNamespace || "");
          params.set("metafieldKey", savedConfig.metafieldKey || "");
        }
        dataFetcher.load(`/app/update-price?${params.toString()}`);
      }
    } catch (e) {
      console.warn("Failed to read localStorage:", e);
    }
    setHydrated(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist to localStorage when values change (only after hydration) ──
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("jpm_weight_config", JSON.stringify({
        weightSource, variantOptionName, metafieldNamespace, metafieldKey,
      }));
      localStorage.setItem("jpm_unit_label", unitLabel);
    } catch (e) { /* ignore */ }
  }, [hydrated, weightSource, variantOptionName, metafieldNamespace, metafieldKey, unitLabel]);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem("jpm_pricing", JSON.stringify(pricing)); } catch (e) { /* ignore */ }
  }, [hydrated, pricing]);

  // ── Initialize pricing for new collections ──
  useEffect(() => {
    setPricing((prev) => {
      const next = { ...prev };
      let changed = false;
      collections.forEach((c) => {
        if (!next[c.id]) { next[c.id] = { ratePerGram: 0, percent: 0 }; changed = true; }
      });
      return changed ? next : prev;
    });
  }, [collections]);

  // ── Reload data helper ──
  const reloadData = useCallback((ws, von, mns, mk) => {
    const params = new URLSearchParams();
    params.set("weightSource", ws);
    if (ws === "variant_option") {
      params.set("variantOptionName", von || "");
    } else if (ws === "metafield") {
      params.set("metafieldNamespace", mns || "");
      params.set("metafieldKey", mk || "");
    }
    dataFetcher.load(`/app/update-price?${params.toString()}`);
  }, [dataFetcher]);

  // ── Data reload feedback ──
  useEffect(() => {
    if (dataFetcher.state === "idle" && dataFetcher.data && hydrated) {
      setToast({ error: false, message: "✅ Data refreshed with new configuration!" });
    }
  }, [dataFetcher.state, dataFetcher.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Computed ──
  const selectedCollections = useMemo(
    () => collections.filter((c) => selectedIds.includes(c.id)),
    [collections, selectedIds]
  );
  const stats = useMemo(() => summarizeSelectedCollections(selectedCollections), [selectedCollections]);
  const invalidCollections = useMemo(
    () => selectedCollections.filter((c) => { const conf = pricing[c.id]; return !conf || !(conf.ratePerGram > 0); }),
    [selectedCollections, pricing]
  );
  const hasInvalidPricing = invalidCollections.length > 0;

  const filterOptions = useMemo(
    () => [{ label: "All Collections", value: "" }, ...selectedCollections.map((c) => ({ label: c.title, value: c.id }))],
    [selectedCollections]
  );

  const variantOptionSelectOptions = useMemo(
    () => [{ label: "— Auto-detect (Weight, wt, grams...) —", value: "" }, ...availableOptionNames.map((name) => ({ label: name, value: name }))],
    [availableOptionNames]
  );

  const selectedMetafieldDef = useMemo(() => {
    if (!tempMetafieldFullKey) return null;
    return metafieldDefinitions.find((d) => `${d.namespace}.${d.key}` === tempMetafieldFullKey);
  }, [tempMetafieldFullKey, metafieldDefinitions]);

  const activeMetafieldDef = useMemo(() => {
    if (weightSource !== "metafield" || !metafieldNamespace || !metafieldKey) return null;
    return metafieldDefinitions.find((d) => d.namespace === metafieldNamespace && d.key === metafieldKey);
  }, [weightSource, metafieldNamespace, metafieldKey, metafieldDefinitions]);

  // ── Flatten Data ──
  const allFlattenedRows = useMemo(() => {
    let rowIndex = 0;
    const rows = [];
    selectedCollections.forEach((col) => {
      const { ratePerGram, percent } = pricing[col.id] || { ratePerGram: 0, percent: 0 };
      const groups = {};
      col.products.forEach((p) => {
        const key = `${p.productId}-${p.weightGrams}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
      });
      Object.values(groups).forEach((groupVariants) => {
        const first = groupVariants[0];
        const calculated = first.weightGrams
          ? calculatePriceFromRate(first.weightGrams, ratePerGram, percent)
          : first.basePrice;
        const newPrice = Math.floor(calculated);
        groupVariants.forEach((v, idx) => {
          rowIndex++;
          rows.push({
            uniqueKey: `${col.id}-${v.variantId}`, sNo: rowIndex, variantId: v.variantId,
            productId: v.productId, title: v.title, variantTitle: v.variantTitle,
            collectionId: col.id, collectionTitle: col.title, weightGrams: v.weightGrams,
            ratePerGram, percent, basePrice: v.basePrice, newPrice,
            isFirstInGroup: idx === 0, hasWeight: !!v.weightGrams,
          });
        });
      });
    });
    return rows;
  }, [selectedCollections, pricing]);

  const sortedFlattenedRows = useMemo(() => {
    if (!filterCollectionId) return allFlattenedRows;
    const sorted = [...allFlattenedRows].sort((a, b) => {
      if (a.collectionId === filterCollectionId && b.collectionId !== filterCollectionId) return -1;
      if (a.collectionId !== filterCollectionId && b.collectionId === filterCollectionId) return 1;
      return 0;
    });
    return sorted.map((row, idx) => ({ ...row, sNo: idx + 1 }));
  }, [allFlattenedRows, filterCollectionId]);

  const totalItems = sortedFlattenedRows.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  useEffect(() => { setCurrentPage(1); setFilterCollectionId(""); }, [selectedIds.length]);

  const currentTableRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedFlattenedRows.slice(start, start + itemsPerPage);
  }, [sortedFlattenedRows, currentPage]);

  const changedVariantsCount = useMemo(() => {
    return allFlattenedRows.reduce((acc, row) => {
      if (row.ratePerGram > 0 && row.hasWeight && Math.abs(row.newPrice - row.basePrice) >= 1) return acc + 1;
      return acc;
    }, 0);
  }, [allFlattenedRows]);

  const allSelected = collections.length > 0 && selectedIds.length === collections.length;

  // ── Button Feedback ──
  useEffect(() => {
    if (fetcher.state === "submitting") setButtonStatus("loading");
    else if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.ok) {
        setButtonStatus("success");
        setToast({ error: false, message: `Successfully updated ${fetcher.data.updated} variants.` });
        setLastUpdated(new Date());
        const timer = setTimeout(() => setButtonStatus("idle"), 2000);
        return () => clearTimeout(timer);
      } else {
        setButtonStatus("idle");
        setToast({ error: true, message: "Failed to update some prices." });
      }
    }
  }, [fetcher.state, fetcher.data]);

  // ── Actions ──
  const toggleCollection = (id) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : collections.map((c) => c.id));
  const handleSelectionDone = () => {
    if (selectedIds.length === 0) setToast({ error: true, message: "Select a collection first." });
    else setSelectionDone(true);
  };
  const handleReselect = () => setSelectionDone(false);

  const openModal = (id) => {
    setModalCollectionId(id);
    const curr = pricing[id] ?? { ratePerGram: 0, percent: 0 };
    setModalRate(String(curr.ratePerGram));
    setModalPercent(String(curr.percent));
  };

  const handleSavePricing = () => {
    const rate = Number(modalRate);
    if (!rate || rate <= 0) { setToast({ error: true, message: "Enter a valid positive rate." }); return; }
    setPricing((prev) => ({ ...prev, [modalCollectionId]: { ratePerGram: rate, percent: Number(modalPercent) } }));
    setModalCollectionId(null);
  };

  const handleApplyPrices = () => {
    const changes = [];
    allFlattenedRows.forEach((row) => {
      if (row.hasWeight && row.ratePerGram > 0 && Math.abs(row.newPrice - row.basePrice) >= 1)
        changes.push({ productId: row.productId, variantId: row.variantId, newPrice: row.newPrice });
    });
    if (changes.length === 0) return setToast({ error: false, message: "No price changes detected." });
    fetcher.submit({ changes: JSON.stringify(changes) }, { method: "post", action: "/app/update-prices" });
  };

  const handleFilterChange = (value) => { setFilterCollectionId(value); setCurrentPage(1); };

  // ── Weight Config Modal ──
  const openWeightConfigModal = () => {
    setTempWeightSource(weightSource);
    setTempVariantOptionName(variantOptionName);
    setTempMetafieldFullKey(metafieldNamespace && metafieldKey ? `${metafieldNamespace}.${metafieldKey}` : "");
    setTempUnitLabel(unitLabel);
    setWeightConfigModalOpen(true);
  };

  const handleSaveWeightConfig = useCallback(() => {
    if (tempWeightSource === "metafield" && !tempMetafieldFullKey) {
      setToast({ error: true, message: "Please select a metafield from the list." });
      return;
    }
    if (!tempUnitLabel.trim()) {
      setToast({ error: true, message: "Please enter a unit label." });
      return;
    }

    let ns = "", k = "";
    if (tempWeightSource === "metafield" && tempMetafieldFullKey) {
      const dotIndex = tempMetafieldFullKey.indexOf(".");
      if (dotIndex > 0) {
        ns = tempMetafieldFullKey.substring(0, dotIndex);
        k = tempMetafieldFullKey.substring(dotIndex + 1);
      }
    }

    const newVon = tempWeightSource === "variant_option" ? tempVariantOptionName : "";
    setWeightSource(tempWeightSource);
    setVariantOptionName(newVon);
    setMetafieldNamespace(ns);
    setMetafieldKey(k);
    setUnitLabel(tempUnitLabel.trim());
    setWeightConfigModalOpen(false);

    reloadData(tempWeightSource, newVon, ns, k);
    setToast({ error: false, message: "⏳ Applying new configuration..." });
  }, [tempWeightSource, tempVariantOptionName, tempMetafieldFullKey, tempUnitLabel, reloadData]);

  const weightSourceLabel = useMemo(() => {
    if (weightSource === "metafield") {
      if (activeMetafieldDef) return `Metafield: ${activeMetafieldDef.name} (${activeMetafieldDef.namespace}.${activeMetafieldDef.key})`;
      if (metafieldNamespace && metafieldKey) return `Metafield: ${metafieldNamespace}.${metafieldKey}`;
      return "Metafield: Not configured";
    }
    if (variantOptionName) return `Variant Option: "${variantOptionName}"`;
    return "Variant Option: Auto-detect (Weight/wt/grams...)";
  }, [weightSource, variantOptionName, metafieldNamespace, metafieldKey, activeMetafieldDef]);

  const getButtonIcon = () => {
    if (buttonStatus === "success") return CheckIcon;
    if (buttonStatus === "loading" || changedVariantsCount > 0) return ComposeIcon;
    return undefined;
  };

  // ── Table Rows ──
  const tableRowsMarkup = currentTableRows.map((row, index) => (
    <IndexTable.Row key={row.uniqueKey} id={row.variantId} position={index}>
      <IndexTable.Cell>
        <div style={{ textAlign: "center", width: "100%" }}>{row.sNo}</div>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {row.isFirstInGroup && (
          <Text fontWeight="bold" as="span">
            {row.title} {row.weightGrams ? `(${row.weightGrams}${unitLabel})` : ""}
          </Text>
        )}
        <div style={{ paddingLeft: row.isFirstInGroup ? 0 : "16px", color: "#6b7280", fontSize: "13px" }}>
          {row.isFirstInGroup ? "" : "↳ "}
          {row.variantTitle === "Default Title" ? "Standard" : row.variantTitle}
        </div>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
          {row.collectionTitle}
          {filterCollectionId && row.collectionId === filterCollectionId && <Badge tone="info" size="small">★</Badge>}
        </div>
      </IndexTable.Cell>
      <IndexTable.Cell>{row.weightGrams ? `${row.weightGrams}${unitLabel}` : "—"}</IndexTable.Cell>
      <IndexTable.Cell>₹{row.ratePerGram}/{unitLabel}</IndexTable.Cell>
      <IndexTable.Cell>{row.percent > 0 ? `+${row.percent}%` : `${row.percent}%`}</IndexTable.Cell>
      <IndexTable.Cell>₹{row.basePrice.toLocaleString()}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text fontWeight="bold" tone="success">₹{row.newPrice.toLocaleString()}</Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Frame>
      <Page fullWidth>
        <Layout>
          {/* 1. HEADER */}
          <Layout.Section>
            <div style={{ border: "1px solid #000000", background: "#ffffff", borderRadius: "12px", padding: "40px 20px", textAlign: "center", marginBottom: "20px", boxShadow: "0px 4px 6px rgba(0,0,0,0.1)" }}>
              <BlockStack gap="200">
                <Text as="h1" variant="heading2xl">Jewellery Price Manager</Text>
                <Text as="p" variant="bodyLg">The command center for automating your daily Gold and Silver pricing updates.</Text>
              </BlockStack>
            </div>
          </Layout.Section>

          {/* 2. Weight Source Config */}
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="050">
                    <Text variant="headingMd" as="h2">⚖️ Weight / Value Source</Text>
                    <Text variant="bodySm" tone="subdued">Configure where the weight value comes from for price calculation</Text>
                  </BlockStack>
                  <InlineStack gap="200" blockAlign="center">
                    {isReloading && <Spinner size="small" />}
                    <Button icon={SettingsIcon} onClick={openWeightConfigModal} variant="secondary" disabled={isReloading}>Configure</Button>
                  </InlineStack>
                </InlineStack>
                <div style={{
                  padding: "12px 16px", borderRadius: "8px", transition: "all 0.3s ease",
                  background: isReloading ? "#fefce8" : "#f0fdf4",
                  border: `1px solid ${isReloading ? "#fde047" : "#bbf7d0"}`,
                }}>
                  <InlineStack gap="400" blockAlign="center" wrap>
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone={isReloading ? "attention" : "success"}>{isReloading ? "Loading..." : "Active"}</Badge>
                      <Text variant="bodyMd" fontWeight="semibold">{weightSourceLabel}</Text>
                    </InlineStack>
                    <Divider />
                    <InlineStack gap="200" blockAlign="center">
                      <Text variant="bodySm" tone="subdued">Unit:</Text>
                      <Badge>{unitLabel}</Badge>
                    </InlineStack>
                  </InlineStack>
                </div>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* 3. Collection Selector */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="050">
                    <Text variant="headingMd" as="h2">Select Collections</Text>
                    <Text variant="bodySm" tone="subdued">Choose collections to manage rates</Text>
                  </BlockStack>
                  <InlineStack gap="200">
                    <Button variant="plain" onClick={toggleSelectAll} disabled={selectionDone}>{allSelected ? "Deselect All" : "Select All"}</Button>
                    <Button variant={selectionDone ? "secondary" : "primary"} onClick={selectionDone ? handleReselect : handleSelectionDone} disabled={selectedIds.length === 0}>
                      {selectionDone ? "Re-select" : "Done"}
                    </Button>
                  </InlineStack>
                </InlineStack>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {collections.map((c) => {
                    const isSelected = selectedIds.includes(c.id);
                    return (
                      <div key={c.id} style={{ opacity: selectionDone && !isSelected ? 0.5 : 1 }}>
                        <Button size="slim" variant={isSelected ? "primary" : "secondary"}
                          onClick={() => !selectionDone && toggleCollection(c.id)} disabled={selectionDone}
                          icon={isSelected ? CheckIcon : undefined}>{c.title}</Button>
                      </div>
                    );
                  })}
                </div>
                {selectedIds.length > 0 && (
                  <div style={{ marginTop: "12px", padding: "16px", background: "#f7f7f7", borderRadius: "8px", border: "1px solid #e1e3e5" }}>
                    <BlockStack gap="200">
                      <Text variant="headingSm" as="h4">Selection Summary</Text>
                      {selectedCollections.map((c) => (
                        <InlineStack key={c.id} align="space-between">
                          <Text variant="bodyMd">{c.title}</Text>
                          <Text variant="bodyMd" tone="subdued">{c.products.length} Products</Text>
                        </InlineStack>
                      ))}
                      <Divider />
                      <InlineStack align="space-between">
                        <Text fontWeight="bold">Total Selected Products</Text>
                        <Text fontWeight="bold">{stats.totalProducts}</Text>
                      </InlineStack>
                    </BlockStack>
                  </div>
                )}
                <div className={`fade-message ${selectedIds.length > 0 ? "hidden" : ""}`}>
                  <Text tone="subdued" alignment="center">Please select at least one collection to begin.</Text>
                </div>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* 4. Rate Cards */}
          {selectionDone && selectedIds.length > 0 && (
            <Layout.Section>
              <div style={{ marginBottom: "20px" }}>
                <Text variant="headingMd" as="h2">Set Metal Rates</Text>
                <Text tone="subdued">Click a card to update rate & markup</Text>
              </div>
              <Grid>
                {selectedCollections.map((c) => {
                  const style = getThemeStyles(c.title);
                  const conf = pricing[c.id];
                  const isInvalid = !conf || conf.ratePerGram <= 0;
                  const finalStyle = isInvalid ? { ...style, background: "#fee2e2", borderColor: "#ef4444", color: "#b91c1c" } : style;
                  return (
                    <Grid.Cell key={c.id} columnSpan={{ xs: 6, sm: 6, md: 3, lg: 3, xl: 3 }}>
                      <div role="button" tabIndex={0} onClick={() => openModal(c.id)} onKeyDown={(e) => e.key === "Enter" && openModal(c.id)} style={finalStyle} className="hover-scale">
                        <BlockStack gap="200">
                          <InlineStack align="space-between">
                            <Text variant="headingSm" as="h3">{c.title}</Text>
                            <div style={{ background: "rgba(255,255,255,0.5)", borderRadius: "50%", padding: "4px" }}><Icon source={EditIcon} tone="base" /></div>
                          </InlineStack>
                          <div>
                            <Text variant="headingXl" as="p">₹{conf?.ratePerGram || 0}<span style={{ fontSize: "14px", fontWeight: "normal", opacity: 0.7 }}>/{unitLabel}</span></Text>
                          </div>
                          <InlineStack align="space-between">
                            <Text variant="bodySm">Markup:</Text>
                            <Badge tone={isInvalid ? "critical" : "info"}>{conf?.percent > 0 ? "+" : ""}{conf?.percent}%</Badge>
                          </InlineStack>
                          {isInvalid && (
                            <div style={{ marginTop: "auto", paddingTop: "8px", borderTop: "1px solid rgba(0,0,0,0.1)" }}>
                              <InlineStack gap="100" align="start"><Icon source={AlertCircleIcon} tone="critical" /><Text variant="bodyxs" tone="critical">Set rate to enable updates</Text></InlineStack>
                            </div>
                          )}
                        </BlockStack>
                      </div>
                    </Grid.Cell>
                  );
                })}
              </Grid>
            </Layout.Section>
          )}

          {/* 5. Table */}
          {selectionDone && selectedIds.length > 0 && (
            <Layout.Section>
              <Card padding="0">
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #e1e3e5" }}>
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="050">
                      <Text variant="headingMd">Price Preview</Text>
                      <Text tone="subdued" variant="bodySm">Last updated: {lastUpdated.toLocaleTimeString()}</Text>
                    </BlockStack>
                    <InlineStack gap="300" blockAlign="center">
                      {selectedCollections.length > 1 && (
                        <div style={{ minWidth: "200px" }}>
                          <Select label="Sort by" labelInline options={filterOptions} value={filterCollectionId} onChange={handleFilterChange} />
                        </div>
                      )}
                      <div className={buttonStatus === "success" ? "btn-success-container" : "btn-initial-container"}>
                        <Button icon={getButtonIcon()} size="large" onClick={handleApplyPrices}
                          loading={buttonStatus === "loading"}
                          disabled={buttonStatus !== "success" && (hasInvalidPricing || stats.totalProducts === 0 || changedVariantsCount === 0)}>
                          {buttonStatus === "success" ? "Updated!" : changedVariantsCount > 0 ? `Update ${changedVariantsCount} Prices` : "No Changes Detected"}
                        </Button>
                      </div>
                    </InlineStack>
                  </InlineStack>
                </div>

                {isReloading && (
                  <div style={{ padding: "12px 20px", background: "#fffbeb", borderBottom: "1px solid #fde047", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Spinner size="small" />
                    <Text variant="bodySm">Refreshing data with new weight configuration...</Text>
                  </div>
                )}

                {stats.totalProducts > 0 ? (
                  <>
                    {filterCollectionId && (
                      <div style={{ padding: "8px 20px", background: "#f0f9ff", borderBottom: "1px solid #e1e3e5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <InlineStack gap="200" blockAlign="center">
                          <Badge tone="info">Sorted</Badge>
                          <Text variant="bodySm">Showing <strong>{selectedCollections.find((c) => c.id === filterCollectionId)?.title}</strong> products first</Text>
                        </InlineStack>
                        <Button variant="plain" size="slim" onClick={() => handleFilterChange("")}>Clear filter</Button>
                      </div>
                    )}
                    <div style={{ opacity: isReloading ? 0.5 : 1, transition: "opacity 0.3s ease", pointerEvents: isReloading ? "none" : "auto" }}>
                      <IndexTable resourceName={{ singular: "variant", plural: "variants" }} itemCount={sortedFlattenedRows.length}
                        headings={[
                          { title: "S.No", alignment: "center" }, { title: "Product" }, { title: "Collection" },
                          { title: `Value (${unitLabel})` }, { title: `Rate (₹/${unitLabel})` },
                          { title: "Markup" }, { title: "Current" }, { title: "New Price" },
                        ]} selectable={false}>
                        {tableRowsMarkup}
                      </IndexTable>
                    </div>
                    {totalPages > 1 && (
                      <div style={{ display: "flex", justifyContent: "center", padding: "16px", borderTop: "1px solid #e1e3e5" }}>
                        <Pagination hasPrevious={currentPage > 1} onPrevious={() => setCurrentPage((p) => p - 1)}
                          hasNext={currentPage < totalPages} onNext={() => setCurrentPage((p) => p + 1)}
                          label={`${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, totalItems)} of ${totalItems}`} />
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ padding: "32px", textAlign: "center" }}>
                    <Text tone="subdued">No variants found in selected collections.</Text>
                  </div>
                )}
              </Card>
              <div style={{ height: "50px" }} />
            </Layout.Section>
          )}
        </Layout>

        {/* Modal: Collection Pricing */}
        <Modal open={!!modalCollectionId} onClose={() => setModalCollectionId(null)} title="Configure Pricing"
          primaryAction={{ content: "Save", onAction: handleSavePricing }}
          secondaryAction={{ content: "Cancel", onAction: () => setModalCollectionId(null) }}>
          <Modal.Section>
            <FormLayout>
              <Text>Setting rates for <strong>{collections.find((c) => c.id === modalCollectionId)?.title}</strong></Text>
              <FormLayout.Group>
                <TextField label={`Rate per ${unitLabel} (₹)`} type="number" value={modalRate} onChange={setModalRate} autoComplete="off" prefix="₹" suffix={`/${unitLabel}`} />
                <TextField label="Markup / Increment (%)" type="number" value={modalPercent} onChange={setModalPercent} autoComplete="off" suffix="%" helpText="Example: 10% adds 10% on top of calculated value." />
              </FormLayout.Group>
            </FormLayout>
          </Modal.Section>
        </Modal>

        {/* Modal: Weight Source */}
        <Modal open={weightConfigModalOpen} onClose={() => setWeightConfigModalOpen(false)}
          title="⚖️ Configure Weight / Value Source"
          primaryAction={{ content: "Save & Apply", onAction: handleSaveWeightConfig }}
          secondaryAction={{ content: "Cancel", onAction: () => setWeightConfigModalOpen(false) }} large>
          <Modal.Section>
            <BlockStack gap="400">
              <Banner tone="info">
                <Text variant="bodySm">Choose where the weight/value data comes from. Changes apply instantly without page reload.</Text>
              </Banner>

              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Data Source</Text>
                <RadioButton label="Variant Option" helpText="Read value from a product variant option (e.g., 'Weight' with values like '10g')"
                  checked={tempWeightSource === "variant_option"} id="source-variant" name="weightSource"
                  onChange={() => setTempWeightSource("variant_option")} />
                <RadioButton label="Product / Variant Metafield" helpText="Read value from a metafield defined in your store"
                  checked={tempWeightSource === "metafield"} id="source-metafield" name="weightSource"
                  onChange={() => setTempWeightSource("metafield")} />
              </BlockStack>

              <Divider />

              {tempWeightSource === "variant_option" && (
                <BlockStack gap="300">
                  <Text variant="headingSm" as="h3">Variant Option Settings</Text>
                  <Select label="Option Name" options={variantOptionSelectOptions} value={tempVariantOptionName}
                    onChange={setTempVariantOptionName} helpText="Select which variant option holds the weight value." />
                  {availableOptionNames.length > 0 && (
                    <div style={{ padding: "8px 12px", background: "#f8f9fa", borderRadius: "6px", border: "1px solid #e1e3e5" }}>
                      <Text variant="bodySm" tone="subdued">
                        📋 Available options: {availableOptionNames.map((name) => (<span key={name}><Badge size="small">{name}</Badge>{" "}</span>))}
                      </Text>
                    </div>
                  )}
                </BlockStack>
              )}

              {tempWeightSource === "metafield" && (
                <BlockStack gap="300">
                  <Text variant="headingSm" as="h3">Select Metafield</Text>
                  <MetafieldPicker metafieldDefinitions={metafieldDefinitions} value={tempMetafieldFullKey} onChange={setTempMetafieldFullKey} />

                  {selectedMetafieldDef && (
                    <div style={{ padding: "14px 16px", background: "#f0fdf4", borderRadius: "10px", border: "1px solid #bbf7d0" }}>
                      <BlockStack gap="200">
                        <InlineStack gap="200" blockAlign="center">
                          <div style={{
                            width: "28px", height: "28px", borderRadius: "6px",
                            background: `${getMetafieldTypeColor(selectedMetafieldDef.type)}15`,
                            border: `1.5px solid ${getMetafieldTypeColor(selectedMetafieldDef.type)}40`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "12px", fontWeight: "700", color: getMetafieldTypeColor(selectedMetafieldDef.type),
                          }}>
                            {getMetafieldTypeIcon(selectedMetafieldDef.type)}
                          </div>
                          <Text variant="headingSm">{selectedMetafieldDef.name}</Text>
                        </InlineStack>
                        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "4px 12px", fontSize: "13px" }}>
                          <Text variant="bodySm" tone="subdued">Namespace:</Text>
                          <code style={{ background: "#f3f4f6", padding: "1px 6px", borderRadius: "4px", fontSize: "12px" }}>{selectedMetafieldDef.namespace}</code>
                          <Text variant="bodySm" tone="subdued">Key:</Text>
                          <code style={{ background: "#f3f4f6", padding: "1px 6px", borderRadius: "4px", fontSize: "12px" }}>{selectedMetafieldDef.key}</code>
                          <Text variant="bodySm" tone="subdued">Type:</Text>
                          <div><Badge size="small">{selectedMetafieldDef.type}</Badge></div>
                          <Text variant="bodySm" tone="subdued">Owner:</Text>
                          <div><Badge size="small" tone={selectedMetafieldDef.ownerType === "PRODUCTVARIANT" ? "info" : "attention"}>
                            {selectedMetafieldDef.ownerType === "PRODUCTVARIANT" ? "Variant" : "Product"}</Badge></div>
                          {selectedMetafieldDef.description && (<>
                            <Text variant="bodySm" tone="subdued">Description:</Text>
                            <Text variant="bodySm">{selectedMetafieldDef.description}</Text>
                          </>)}
                        </div>
                      </BlockStack>
                    </div>
                  )}

                  <div style={{ padding: "12px 16px", background: "#fffbeb", borderRadius: "8px", border: "1px solid #fbbf24" }}>
                    <BlockStack gap="100">
                      <Text variant="bodySm" fontWeight="semibold">💡 How it works:</Text>
                      <Text variant="bodySm">Checks <strong>variant-level</strong> metafield first, falls back to <strong>product-level</strong>. Value should be a number.</Text>
                    </BlockStack>
                  </div>

                  {metafieldDefinitions.length === 0 && (
                    <Banner tone="warning">
                      <Text variant="bodySm">No metafield definitions found. Create them in <strong>Settings → Custom data</strong>.</Text>
                    </Banner>
                  )}
                </BlockStack>
              )}

              <Divider />

              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Unit Label</Text>
                <TextField label="Display Unit" value={tempUnitLabel} onChange={setTempUnitLabel}
                  autoComplete="off" placeholder="g" helpText="Appears in table columns and rate cards" maxLength={10} />
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {["g", "gm", "gram", "kg", "oz", "tola", "ct"].map((u) => (
                    <Button key={u} size="micro" variant={tempUnitLabel === u ? "primary" : "tertiary"} onClick={() => setTempUnitLabel(u)}>{u}</Button>
                  ))}
                </div>
              </BlockStack>
            </BlockStack>
          </Modal.Section>
        </Modal>

        {toast && <Toast content={toast.message} error={toast.error} onDismiss={() => setToast(null)} />}

        <style>{`
          .hover-scale:hover { transform: translateY(-4px); box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important; }
          .fade-message { opacity: 1; max-height: 50px; transition: opacity 0.5s ease, max-height 0.5s ease; overflow: hidden; text-align: center; margin-top: 10px; }
          .fade-message.hidden { opacity: 0; max-height: 0; margin-top: 0; }
          .btn-initial-container .Polaris-Button { background: #ecfdf5 !important; border: 1px solid #10b981 !important; color: #065f46 !important; fill: #065f46 !important; }
          .btn-initial-container .Polaris-Button:hover:not(.Polaris-Button--disabled) { background: #d1fae5 !important; }
          .btn-initial-container .Polaris-Button--disabled { background: #f1f2f3 !important; border-color: #e1e3e5 !important; color: #8c9196 !important; fill: #8c9196 !important; opacity: 0.6; }
          .btn-success-container .Polaris-Button { background: #e0f2fe !important; border: 1px solid #0ea5e9 !important; color: #0c4a6e !important; fill: #0c4a6e !important; }
          .btn-success-container .Polaris-Button:hover { background: #bae6fd !important; }
          .Polaris-Select__Content { min-width: 180px; }
        `}</style>
      </Page>
    </Frame>
  );
}