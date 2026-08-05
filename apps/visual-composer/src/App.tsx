import { useCallback, useMemo, useState, type DragEvent } from "react";
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type NodeMouseHandler,
} from "@xyflow/react";
import {
  compileDockerCompose,
  createRemovalManifest,
  validateBlueprint,
  type BlueprintProfile,
  type InfrastructureBlueprint,
} from "@stoic-iris/blueprints";
import {
  blueprintDiff,
  createPaletteNode,
  fromFlow,
  layoutFlow,
  paletteKinds,
  toFlow,
  type ComposerNode,
} from "./model.js";
import { sampleBlueprint } from "./sample-blueprint.js";

function download(name: string, content: string, type = "application/json"): void {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

function Composer(): React.JSX.Element {
  const initial = useMemo(() => toFlow(sampleBlueprint), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<ComposerNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [base, setBase] = useState<InfrastructureBlueprint>(sampleBlueprint);
  const [approvedSnapshot] = useState<InfrastructureBlueprint>(sampleBlueprint);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<"inspector" | "validation" | "diff" | "operations">(
    "inspector",
  );
  const flow = useReactFlow<ComposerNode>();
  const blueprint = useMemo(() => fromFlow(base, nodes, edges), [base, edges, nodes]);
  const findings = useMemo(() => validateBlueprint(blueprint), [blueprint]);
  const selected = nodes.find(({ id }) => id === selectedId);
  const total = blueprint.nodes.reduce((sum, node) => sum + node.resources.hourlyCostUsd, 0);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) =>
        addEdge(
          { ...connection, id: `edge-${crypto.randomUUID().slice(0, 8)}`, label: "dependency" },
          current,
        ),
      );
    },
    [setEdges],
  );
  const onNodeClick: NodeMouseHandler<ComposerNode> = useCallback((_event, node) => {
    setSelectedId(node.id);
    setPanel("inspector");
  }, []);
  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData(
        "application/iris-node",
      ) as (typeof paletteKinds)[number];
      if (!paletteKinds.includes(kind)) return;
      const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
      const blueprintNode = createPaletteNode(kind, id);
      setNodes((current) => [
        ...current,
        {
          id,
          position: flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
          data: { blueprint: blueprintNode, health: "unknown", logs: ["Awaiting deployment."] },
          ariaLabel: `${blueprintNode.name}, ${kind} infrastructure node`,
        },
      ]);
    },
    [flow, setNodes],
  );
  const updateSelected = (field: "name" | "license", value: string): void => {
    if (selectedId === null) return;
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedId
          ? {
              ...node,
              data: {
                ...node.data,
                blueprint:
                  field === "name"
                    ? { ...node.data.blueprint, name: value }
                    : {
                        ...node.data.blueprint,
                        provenance: { ...node.data.blueprint.provenance, license: value },
                      },
              },
            }
          : node,
      ),
    );
  };
  const setProfile = (profile: BlueprintProfile): void => {
    setBase((current) => ({ ...current, profile, approvalStatus: "draft" }));
  };
  const requestApproval = (): void => {
    setBase((current) => ({ ...current, approvalStatus: "pending" }));
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">STOIC-IRIS</span>
          <h1>Visual Infrastructure Composer</h1>
        </div>
        <div className="top-actions">
          <label>
            Profile{" "}
            <select
              value={base.profile}
              onChange={(event) => {
                setProfile(event.target.value as BlueprintProfile);
              }}
            >
              {["development", "test", "staging", "production"].map((profile) => (
                <option key={profile}>{profile}</option>
              ))}
            </select>
          </label>
          <span className={`approval ${base.approvalStatus}`}>{base.approvalStatus}</span>
          <button
            onClick={requestApproval}
            disabled={findings.some(({ severity }) => severity === "error")}
          >
            Request approval
          </button>
        </div>
      </header>
      <section className="summary" aria-label="Blueprint summary">
        <div>
          <strong>{nodes.length}</strong>
          <span>nodes</span>
        </div>
        <div>
          <strong>{edges.length}</strong>
          <span>connections</span>
        </div>
        <div>
          <strong>{findings.length}</strong>
          <span>findings</span>
        </div>
        <div>
          <strong>${total.toFixed(2)}</strong>
          <span>hourly estimate</span>
        </div>
      </section>
      <div className="workspace">
        <aside className="palette" aria-label="Node palette">
          <h2>Node palette</h2>
          <p>Drag infrastructure onto the canvas.</p>
          {paletteKinds.map((kind) => (
            <button
              key={kind}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("application/iris-node", kind);
              }}
            >
              <span className={`kind-dot ${kind}`} />
              {kind}
            </button>
          ))}
          <hr />
          <button onClick={() => void layoutFlow(nodes, edges).then(setNodes)}>
            Auto-layout graph
          </button>
        </aside>
        <section
          className="canvas"
          aria-label="Infrastructure canvas"
          onDrop={onDrop}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            fitView
            nodesFocusable
            edgesFocusable
            autoPanOnNodeFocus
            ariaLabelConfig={{
              "node.a11yDescription.default":
                "Press enter to select this infrastructure node. Use arrow keys to move it.",
            }}
          >
            <Background color="#263848" gap={24} />
            <MiniMap pannable zoomable aria-label="Infrastructure minimap" />
            <Controls showInteractive />
          </ReactFlow>
        </section>
        <aside className="detail">
          <nav aria-label="Detail panels">
            {(["inspector", "validation", "diff", "operations"] as const).map((name) => (
              <button
                className={panel === name ? "active" : ""}
                key={name}
                onClick={() => {
                  setPanel(name);
                }}
              >
                {name}
              </button>
            ))}
          </nav>
          {panel === "inspector" && (
            <div className="panel">
              <h2>Node inspector</h2>
              {selected === undefined ? (
                <p>Select a node to inspect source, license, security, and resources.</p>
              ) : (
                <>
                  <label>
                    Name
                    <input
                      value={selected.data.blueprint.name}
                      onChange={(event) => {
                        updateSelected("name", event.target.value);
                      }}
                    />
                  </label>
                  <dl>
                    <dt>Kind</dt>
                    <dd>{selected.data.blueprint.kind}</dd>
                    <dt>Image lock</dt>
                    <dd className="mono">
                      {selected.data.blueprint.image?.digest.slice(0, 18) ?? "not applicable"}…
                    </dd>
                    <dt>Source</dt>
                    <dd>{selected.data.blueprint.provenance.source}</dd>
                    <dt>License</dt>
                    <dd>
                      <input
                        value={selected.data.blueprint.provenance.license}
                        onChange={(event) => {
                          updateSelected("license", event.target.value);
                        }}
                      />
                    </dd>
                    <dt>CPU / memory</dt>
                    <dd>
                      {selected.data.blueprint.resources.cpuCores} cores /{" "}
                      {selected.data.blueprint.resources.memoryMiB} MiB
                    </dd>
                    <dt>Security</dt>
                    <dd>
                      {selected.data.blueprint.security.runAsNonRoot ? "non-root" : "root"},{" "}
                      {selected.data.blueprint.security.readOnlyRootFilesystem
                        ? "read-only"
                        : "writable"}
                    </dd>
                    <dt>Health</dt>
                    <dd>{selected.data.health}</dd>
                  </dl>
                </>
              )}
            </div>
          )}
          {panel === "validation" && (
            <div className="panel">
              <h2>Architecture validation</h2>
              {findings.length === 0 ? (
                <p className="success">
                  No policy, dependency, exposure, secret, port, cost, or capacity findings.
                </p>
              ) : (
                <ul className="findings">
                  {findings.map((item, index) => (
                    <li key={`${item.code}-${String(index)}`} className={item.severity}>
                      <strong>{item.code}</strong>
                      {item.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {panel === "diff" && (
            <div className="panel">
              <h2>Blueprint diff</h2>
              <ul>
                {blueprintDiff(approvedSnapshot, blueprint).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {blueprintDiff(approvedSnapshot, blueprint).length === 0 && (
                <p>No changes from the last approved snapshot.</p>
              )}
            </div>
          )}
          {panel === "operations" && (
            <div className="panel">
              <h2>Health and logs</h2>
              <p>
                Runtime telemetry is provider-owned and read-only here. Unknown is never promoted to
                healthy.
              </p>
              <div className="log">
                {selected?.data.logs.join("\n") ?? "Select a node to view its bounded log stream."}
              </div>
              <h2>Export controls</h2>
              <button
                onClick={() => {
                  download(`${blueprint.id}.json`, JSON.stringify(blueprint, null, 2));
                }}
              >
                Export blueprint
              </button>
              <button
                onClick={() => {
                  download("compose.yaml", compileDockerCompose(blueprint), "text/yaml");
                }}
              >
                Export Compose
              </button>
              <button
                onClick={() => {
                  download(
                    "removal-manifest.json",
                    JSON.stringify(createRemovalManifest(blueprint), null, 2),
                  );
                }}
              >
                Export removal plan
              </button>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

export function App(): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <Composer />
    </ReactFlowProvider>
  );
}
