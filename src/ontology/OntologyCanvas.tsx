import { Component, useEffect, type ReactNode } from 'react';
import ReactFlow, { Background, Controls, useNodesInitialized, useNodesState, useReactFlow, useStore, type Edge, type Node, type NodeTypes } from 'reactflow';
import { RefreshCw } from 'lucide-react';
import { retainNodeMeasurements } from './model';

class GraphBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error('Ontology graph rendering failed', error); }
  render() {
    return this.state.failed ? <div className="ontology-graph-error" role="alert"><strong>Graph temporarily unavailable</strong><span>Snapshot details remain available.</span><button onClick={() => this.setState({ failed: false })}><RefreshCw size={16} />Retry graph</button></div> : this.props.children;
  }
}

function GraphViewport({ layoutKey }: { layoutKey: string }) {
  const initialized = useNodesInitialized();
  const width = useStore(store => store.width);
  const height = useStore(store => store.height);
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (!initialized || width <= 0 || height <= 0) return;
    // Refit measured layouts, not telemetry ticks; cancel work when a tab unmounts.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => fitView({ padding: 0.15, minZoom: 0.12, maxZoom: 1.1, duration: 0 }));
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [initialized, width, height, layoutKey, fitView]);
  return null;
}

export default function OntologyCanvas({ nodes, edges, nodeTypes, layoutKey, onSelect }: {
  nodes: Node[]; edges: Edge[]; nodeTypes: NodeTypes; layoutKey: string; onSelect: (id: string) => void;
}) {
  const [measuredNodes, setNodes, onNodesChange] = useNodesState([]);
  useEffect(() => {
    // Match TwinWorkspace: fresh live data must retain ReactFlow's node dimensions.
    setNodes(previous => retainNodeMeasurements(nodes, previous));
  }, [nodes, setNodes]);
  return <div className="ontology-canvas" data-testid="ontology-graph"><GraphBoundary>
    <ReactFlow nodes={measuredNodes} onNodesChange={onNodesChange} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.15 }} minZoom={0.12} maxZoom={1.8} nodesDraggable={false} nodesConnectable={false} onNodeClick={(_, node) => onSelect(node.id)} attributionPosition="bottom-left">
      <Background color="#354b46" gap={24} /><Controls showInteractive={false} /><GraphViewport layoutKey={layoutKey} />
    </ReactFlow>
  </GraphBoundary></div>;
}
