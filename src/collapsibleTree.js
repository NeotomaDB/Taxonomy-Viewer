import { setupFocusInfo } from './searchFocus.js?v=20260815-toggle-highlight-1';
import { setupSearch } from './search.js?v=20260815-expand-refresh-1';
import { highlightPath } from './highlight.js?v=20260815-toggle-highlight-1';
import { setHighlightedPath } from './viewSwitch.js';
import { attachSynonymMetadata } from './data.js';
import { initSynonyms, getSynonymInfo, isSynonymsReady } from './synonyms.js';
import { setupHover } from './hover.js';
import { getURLState } from './urlhash.js';
import { formatDenseNodeLabel, prepareDenseSearchTree } from './denseSearchTree.js?v=20260815-dense-search-1';

/**
 * Render a collapsible tree layout.
 * Supports mouse/trackpad pan & zoom.
 * Root label is not clipped on the left.
 */
export async function renderCollapsibleTree({
    rows,
    allRowsForSynonyms = null,
    selector = '#chart',
    rootId,
    rootName,
    width = null,
    height = null,
    anchorIds = new Set(), // Set of anchor IDs to highlight in green
    expandAll = false,     // If true, show the full tree fully expanded at init
    initialQuery = '',
    autoRunSearch = false,
    taxagroupid = null,    // e.g. 'DIA' — used to show external links like AlgaeBase
    dx = 25,               // Vertical node spacing
    dy = null,             // Horizontal level spacing (null = auto-calculate)
    hideRoot = false,      // Layout-only root for a forest of disconnected trees
    fitToViewport = false, // Fit a filtered horizontal path between its label gutters
    denseSearch = false,   // Keep large filtered result trees initially compact
} = {}) {
    if (!rows || !rows.length) {
        console.warn('renderCollapsibleTree: rows is empty.');
        return;
    }

    // Defensive clear so repeated Focus View renders cannot stack multiple
    // collapsible SVGs inside the same chart container.
    d3.select(selector).selectAll('*').remove();

    // Build hierarchy from path-list
    const byId = new Map();
    const root = {
        id: rootId,
        name: rootName,
        children: [],
        isVirtualForestRoot: hideRoot,
    };
    byId.set(rootId, root);

    rows.forEach(row => {
        const ids = row.ids_root_to_leaf || [];
        const names = row.names_root_to_leaf || [];

        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const name = names[i];

            if (!byId.has(id)) {
                byId.set(id, { 
                    id, 
                    name, 
                    taxagroupid: row.taxagroupid,
                    isSyntheticGroup: row.isSyntheticGroup,
                    isAnchor: anchorIds.has(parseInt(id)) || anchorIds.has(id.toString()),
                    children: [] 
                });
            } else {
                const nodeRef = byId.get(id);
                if (!nodeRef.taxagroupid && row.taxagroupid) nodeRef.taxagroupid = row.taxagroupid;
                if (!nodeRef.isSyntheticGroup && row.isSyntheticGroup) nodeRef.isSyntheticGroup = row.isSyntheticGroup;
            }

            if (i === ids.length - 1) {
                byId.get(id).isRecordedTerminal = true;
            }

            if (i > 0) {
                const parentId = ids[i - 1];
                const parent = byId.get(parentId);
                const child = byId.get(id);

                if (parent && child && !parent.children.includes(child)) {
                    parent.children.push(child);
                }
            } else if (hideRoot && String(id) !== String(rootId)) {
                // Attach each recorded root to an internal layout container.
                // The container and these links are never rendered.
                const child = byId.get(id);
                if (child && !root.children.includes(child)) {
                    root.children.push(child);
                }
            }
        }
    });

    // Sort children alphabetically at every level so siblings appear A→Z.
    // Applied before d3.hierarchy() so the layout reflects sorted order.
    (function sortTree(node) {
        if (node.children && node.children.length > 1) {
            node.children.sort((a, b) => a.name.localeCompare(b.name));
            node.children.forEach(sortTree);
        }
    })(root);

    // Attach synonym metadata onto canonical nodes so search & info panel can
    // resolve synonym queries (same as the radial tree does via taxon_group_viz.js).
    const synonymManager = {
        isReady: () => isSynonymsReady(),
        getSynonymInfo: (id) => getSynonymInfo(id),
    };
    const rowsForSynonymLookup = allRowsForSynonyms || rows;
    const invalidIdToCanonicalId = attachSynonymMetadata(
        root, byId, synonymManager, rowsForSynonymLookup
    );
    // Expose the reverse lookup globally so search.js can resolve synonym queries.
    window.__invalidIdToCanonicalId = invalidIdToCanonicalId;

    // Convert to d3 hierarchy
    const hierarchyRoot = d3.hierarchy(root);

    // Also sort on the d3 hierarchy object to guarantee alphabetical order
    // even if the pre-sort above was somehow skipped (e.g. module cache).
    hierarchyRoot.sort((a, b) => a.data.name.localeCompare(b.data.name));

    const container = document.querySelector(selector);
    // A previous Focus View may have left the horizontal scroller at the far
    // right. Always start a newly rendered tree from the visible origin.
    if (container) {
        container.scrollLeft = 0;
        container.scrollTop = 0;
    }
    const stage = container ? container.closest('#stage') || container.parentElement : null;
    const stageRect = stage ? stage.getBoundingClientRect() : null;
    const availableWidth = Math.floor((stageRect?.width || 900) - 18);
    const availableHeight = Math.floor((window.innerHeight || 900) - 54);
    width = Number.isFinite(width) && width > 0
        ? width
        : Math.max(620, Math.min(availableWidth, 1280));
    height = Number.isFinite(height) && height > 0
        ? height
        : Math.max(620, Math.min(availableHeight, 1100));

    // Tree layout
    const _dx = dx;
    // Use explicitly passed dy, fallback to manual large scale or auto scale
    const _dy = dy !== null ? dy : (width / (hierarchyRoot.height + 1));
    const tree = d3.tree().nodeSize([_dx, _dy]);

    // Default: collapse everything beyond depth 1 so the tree opens compactly.
    // When expandAll=true (small, manageable groups) keep every node open.
    if (denseSearch) {
        prepareDenseSearchTree(hierarchyRoot, {
            query: initialQuery,
            visibleNodeBudget: 40,
        });
    } else {
        hierarchyRoot.descendants().forEach((d) => {
            if (expandAll) {
                // Leave d.children intact; stash a copy in _children for toggle use
                d._children = d.children && d.children.length ? d.children : null;
            } else {
                d._children = d.children;
                if (d.depth > 1) {
                    d.children = null;
                }
            }
        });
    }

    // Left margin: enough space for the root label so it is never clipped.
    // ~7px per character is a rough estimate for 12px Figtree.
    const leftMargin = hideRoot
        ? 32
        : Math.max(String(rootName || '').length * 7 + 24, _dy * 0.6);

    const longestTerminalLabel = hierarchyRoot.descendants()
        .filter(node => !node.children || node.children.length === 0)
        .reduce(
            (longest, node) => Math.max(
                longest,
                String(node.data?.name || '').length,
            ),
            0,
        );
    const rightLabelGutter = Math.max(
        180,
        Math.min(340, longestTerminalLabel * 7 + 32),
    );

    // Create SVG — overflow:visible so labels outside the SVG box are shown
    d3.select(selector).classed('focus-path-mode', fitToViewport);
    const svg = d3.select(selector).append('svg')
        .classed('focus-path-tree', fitToViewport)
        .attr('width', width)
        .attr('height', height)
        .style('font', '12px "Figtree", sans-serif')
        .style('user-select', 'none')
        .style('overflow', 'visible');    // <-- prevents label clipping

    // Also allow the #chart container to show overflow
    d3.select(selector).style('overflow', fitToViewport ? null : 'visible');

    // Inner <g> that zoom/pan transforms are applied to
    const gMain = svg.append('g');

    const gLink = gMain.append('g')
        .attr('fill', 'none')
        .attr('stroke', '#9aa0a6')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', 1.5);

    const gNode = gMain.append('g')
        .attr('cursor', 'pointer')
        .attr('pointer-events', 'all');

    // Zoom behaviour — transforms gMain
    const zoom = d3.zoom()
        .scaleExtent([0.1, 8])
        .on('zoom', (event) => {
            gMain.attr('transform', event.transform);
        });

    svg.call(zoom).on('dblclick.zoom', null);

    // Track whether the initial centering has been applied
    let initialised = false;

    const displayY = (node) => (node?.y || 0) - (hideRoot ? _dy : 0);

    let searchController = null;

    function update(source) {
        const duration = 250;

        // Compute new tree layout
        tree(hierarchyRoot);

        // The layout-only root lets D3 position multiple real roots in one SVG,
        // but it is not a taxon. Exclude it and its outgoing links entirely.
        const nodes = hierarchyRoot.descendants().reverse()
            .filter(d => !d.data.isVirtualForestRoot);
        const links = hierarchyRoot.links()
            .filter(d => !d.source.data.isVirtualForestRoot);

        // Find vertical extent
        let topNode = nodes[0] || hierarchyRoot;
        let bottomNode = nodes[0] || hierarchyRoot;
        nodes.forEach(node => {
            if (node.x < topNode.x) topNode = node;
            if (node.x > bottomNode.x) bottomNode = node;
        });

        // Only centre the view on the very first render
        if (!initialised) {
            // Calculate max horizontal position of the nodes
            let maxNodeY = 0;
            nodes.forEach(node => {
                if (displayY(node) > maxNodeY) maxNodeY = displayY(node);
            });

            let initialScale = 1;
            let translateX;
            if (initialQuery || fitToViewport) {
                // Fit the complete visible tree into the actual canvas, not an
                // oversized horizontally scrolling SVG. Include both horizontal
                // and vertical extents so no path starts outside the viewport.
                const availableTreeWidth = Math.max(1, width - leftMargin - rightLabelGutter);
                const visibleTreeHeight = Math.max(1, bottomNode.x - topNode.x);
                const availableTreeHeight = Math.max(1, height - 120);
                initialScale = Math.max(0.1, Math.min(
                    1,
                    availableTreeWidth / Math.max(1, maxNodeY),
                    availableTreeHeight / visibleTreeHeight,
                ));
                translateX = leftMargin;
            } else {
                // Align the rightmost nodes with the right edge of the white box.
                translateX = width - maxNodeY - 180;
                // Small trees should not get stuck to the far right.
                if (translateX > leftMargin) translateX = leftMargin;
            }

            const centerY = height / 2 -
                (((topNode.x + bottomNode.x) / 2) * initialScale);
            svg.call(
                zoom.transform,
                d3.zoomIdentity.translate(translateX, centerY).scale(initialScale)
            );
            if (container) {
                container.scrollLeft = 0;
                container.scrollTop = 0;
            }
            initialised = true;
        }

        const transition = svg.transition().duration(duration);

        // --- nodes ---
        // Bind only real taxon nodes. Nested toggle <g> controls must never
        // participate in the hierarchy data join.
        const node = gNode.selectAll('g.node')
            .data(nodes, d => d.id || (d.id = ++i));

        const selectNode = (event, d) => {
            // Clear any previous highlights manually
            document.querySelectorAll('.highlight').forEach(el => {
                el.classList.remove('highlight');
            });

            // Set new highlight to the clicked path
            highlightPath(gLink.selectAll('path'), gNode.selectAll('g.node'), d);
            setHighlightedPath(d);

            if (typeof info !== 'undefined' && info) {
                info.show(d, { history: 'push' });
            }
        };

        const toggleBranch = (event, d) => {
            event.stopPropagation();
            if (d.children || d._children) {
                d.children = d.children ? null : d._children;
                update(d);
                searchController?.refreshSearchVisibility?.();
            }
        };

        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${displayY({ y: source.y0 ?? source.y ?? 0 })},${source.x0 ?? source.x ?? 0})`)
            .attr('fill-opacity', 0)
            .attr('stroke-opacity', 0)
            .on('click', selectNode)
            .on('dblclick', (event, d) => {
                if (window.navigateToNode && d.data && d.data.taxagroupid) {
                    // Navigate directly to the clicked taxagroup if the function exists
                    window.navigateToNode(d.data.id, d.data.name, d.data.taxagroupid);
                }
            });

        nodeEnter.append('circle')
            .attr('class', 'node-marker')
            .attr('r', 4.5);

        // Match the Major Groups interaction: keep the taxon dot at the node
        // and place a separate +/− control on the incoming branch.
        const toggleGroup = nodeEnter.append('g')
            .attr('class', 'node-toggle-group')
            .attr('transform', 'translate(-22, 0)')
            .on('click', toggleBranch)
            .on('keydown', (event, d) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleBranch(event, d);
                }
            });

        toggleGroup.append('circle')
            .attr('class', 'node-toggle-button')
            .attr('r', 7);

        toggleGroup.append('text')
            .attr('class', 'toggle node-toggle')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.34em')
            .attr('aria-hidden', 'true');

        nodeEnter.append('text')
            .attr('class', 'node-label')
            .attr('dy', '0.31em')
            .attr('x', 10)
            .attr('text-anchor', 'start')
            // Keep labels as one unstroked text element. Chromium corrupts its
            // native find-in-page highlight when searchable SVG text has a
            // stroke; index.css supplies a text-shadow halo instead.
            .text(d => denseSearch ? formatDenseNodeLabel(d) : d.data.name);

        const positionedNodes = node.merge(nodeEnter);
        positionedNodes.select('circle.node-marker')
            .attr('fill', d => d.data?.isAnchor ? '#2e7d32' : '#999')
            .attr('stroke', 'none');
        positionedNodes.select('g.node-toggle-group')
            .style('display', d => (d.children || d._children) ? null : 'none')
            .attr('tabindex', d => (d.children || d._children) ? 0 : null)
            .attr('role', d => (d.children || d._children) ? 'button' : null)
            .attr('aria-expanded', d => (d.children || d._children) ? String(!!d.children) : null)
            .attr('aria-label', d => {
                if (!d.children && !d._children) return null;
                const action = d.children ? 'Collapse' : 'Expand';
                const count = Number(d.data?.filteredTaxonCount || 0);
                return `${action} ${d.data?.name || 'taxon branch'}${count > 1 ? `, ${count} taxa` : ''}`;
            });
        positionedNodes.select('circle.node-toggle-button')
            .attr('fill', '#f3f4f6')
            .attr('stroke', '#43a047')
            .attr('stroke-width', 1.5);
        positionedNodes.select('text.node-toggle')
            .text(d => d.children ? '−' : (d._children ? '+' : ''));
        positionedNodes.select('text.node-label')
            .attr('x', 10)
            .attr('text-anchor', 'start')
            .text(d => denseSearch ? formatDenseNodeLabel(d) : d.data.name);
        if (fitToViewport) {
            // Focus View is rebuilt and searched immediately. Position its
            // nodes synchronously so the search refresh cannot interrupt the
            // enter transition and leave every label stacked at the origin.
            positionedNodes
                .attr('transform', d => `translate(${displayY(d)},${d.x})`)
                .attr('fill-opacity', 1)
                .attr('stroke-opacity', 1);
        } else {
            positionedNodes.transition(transition)
                .attr('transform', d => `translate(${displayY(d)},${d.x})`)
                .attr('fill-opacity', 1)
                .attr('stroke-opacity', 1);
        }

        node.exit().transition(transition).remove()
            .attr('transform', d => `translate(${displayY(source)},${source.x})`)
            .attr('fill-opacity', 0)
            .attr('stroke-opacity', 0);

        // --- links ---
        const link = gLink.selectAll('path')
            .data(links, d => d.target.id);

        const linkEnter = link.enter().append('path')
            .attr('d', d => {
                const o = { x: source.x0 || 0, y: source.y0 || 0 };
                return diagonal({ source: o, target: o });
            });

        const positionedLinks = link.merge(linkEnter);
        if (fitToViewport) {
            positionedLinks.attr('d', diagonal);
        } else {
            positionedLinks.transition(transition).attr('d', diagonal);
        }

        link.exit().transition(transition).remove()
            .attr('d', d => {
                const o = { x: source.x, y: source.y };
                return diagonal({ source: o, target: o });
            });

        setupHover(gNode.selectAll('g.node'), { taxagroupid });

        // Stash positions
        hierarchyRoot.eachBefore(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    function diagonal(d) {
        const sourceY = displayY(d.source);
        const targetY = displayY(d.target);
        return `M${sourceY},${d.source.x}
            C${(sourceY + targetY) / 2},${d.source.x}
             ${(sourceY + targetY) / 2},${d.target.x}
             ${targetY},${d.target.x}`;
    }

    function findNodeInAll(node, targetId) {
        if (String(node.data.id) === String(targetId) ||
            String(node.data.taxonid) === String(targetId)) {
            return node;
        }
        const kids = node.children || node._children || [];
        for (const child of kids) {
            const found = findNodeInAll(child, targetId);
            if (found) return found;
        }
        return null;
    }

    let i = 0;

    // Setup info panel BEFORE running update() so node click bindings don't trigger ReferenceError on "info"
    const info = setupFocusInfo(() => gNode.selectAll('g.node'), () => 0);

    update(hierarchyRoot);

    // Setup search functionality
    searchController = setupSearch({
        root: hierarchyRoot,
        link: gLink.selectAll('path'),
        node: gNode.selectAll('g.node'),
        svg,
        getLiveLinks: () => gLink.selectAll('path'),
        getLiveNodes: () => gNode.selectAll('g.node'),
        info,
        setCurrentRotate: () => { },
        updateRotate: () => { },
        updateLabelOrientation: () => { },
        initialQuery,
        autoRunSearch,
        keepResultsListOnSelect: false,  // click a result → show details + synonym + Back button
        // Keep every taxon name on the selected root-to-leaf path visible.
        hideAncestorLabelsOnSelect: false,
        disableGoToTree: true,           // we're already in a tree; navigateToNode is irrelevant here
        taxagroupid: taxagroupid || rows?.[0]?.taxagroupid || null,
        onSearchClear: () => { },
    });

    // Restore focus node from URL state if requested
    window.addEventListener('RestoreFocusNode', (e) => {
        const focusId = Number(e.detail.id);

        const targetNode = findNodeInAll(hierarchyRoot, focusId);
        
        if (targetNode) {
            // Expand path to node
            let current = targetNode;
            let neededUpdate = false;
            while (current.parent) {
                if (current.parent._children) {
                    current.parent.children = current.parent._children;
                    current.parent._children = null;
                    neededUpdate = true;
                }
                current = current.parent;
            }
            if (neededUpdate) {
                update(targetNode);
            }
            
            setTimeout(() => {
                highlightPath(gLink.selectAll('path'), gNode.selectAll('g.node'), targetNode);
                setHighlightedPath(targetNode);
                if (!getURLState().q && info) {
                    info.show(targetNode, { history: 'none' });
                }
            }, 300);
        }
    }, { once: true });
}
