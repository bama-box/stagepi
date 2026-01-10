import { useState, useEffect } from 'preact/hooks';
import { FiPlay, FiSquare, FiTrash2, FiEdit2, FiX, FiCheck } from 'react-icons/fi';
import { GiSoundWaves } from 'react-icons/gi';
import { BsEthernet } from 'react-icons/bs';
import './Aes67.css';
import { API_BASE_URL } from '../../config';

interface Stream {
  id: string;
  mode: 'input' | 'output';
  addr: string;
  port: number | string;
  hw_device?: string;
  net_device?: string;
  enabled?: boolean;
}

// Helper functions to convert between frontend and backend field names
function streamToBackend(stream: Partial<Stream>): any {
  const backend: any = {};
  if (stream.id !== undefined) backend.id = stream.id;
  if (stream.mode !== undefined) backend.kind = stream.mode === 'input' ? 'sender' : 'receiver';
  if (stream.addr !== undefined) backend.ip = stream.addr;
  if (stream.port !== undefined) backend.port = stream.port;
  if (stream.hw_device !== undefined) backend.device = stream.hw_device;
  if (stream.net_device !== undefined) backend.iface = stream.net_device;
  if (stream.enabled !== undefined) backend.enabled = stream.enabled;
  return backend;
}

function streamFromBackend(backend: any): Stream {
  return {
    id: backend.id || `s-${Math.random().toString(16).slice(2, 10)}`,
    mode: backend.kind === 'sender' ? 'input' : 'output',
    addr: backend.ip || '239.69.22.10',
    port: backend.port ?? 5004,
    hw_device: backend.device || '',
    net_device: backend.iface || '',
    enabled: typeof backend.enabled === 'boolean' ? backend.enabled : true,
  };
}

export function Aes67() {
  const [streams, setStreams] = useState<Stream[] | null>(null);
  const [editStreams, setEditStreams] = useState<Stream[] | null>(null);
  const [editingIds, setEditingIds] = useState<string[]>([]);
  const [netDevices, setNetDevices] = useState<string[]>([]);
  const [soundInputs, setSoundInputs] = useState<any[]>([]);
  const [soundOutputs, setSoundOutputs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);


  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [sRes, nRes, siRes, soRes] = await Promise.all([
          fetch(`${API_BASE_URL}/streams`),
          fetch(`${API_BASE_URL}/network/interfaces`),
          fetch(`${API_BASE_URL}/sound/input`),
          fetch(`${API_BASE_URL}/sound/output`),
        ]);
        if (!sRes.ok) throw new Error('Failed to fetch streams');
        if (!nRes.ok) throw new Error('Failed to fetch network interfaces');
        const sJson = await sRes.json();
        const nJson = await nRes.json();
        let siJson: any = [];
        let soJson: any = [];
        try { siJson = await siRes.json(); } catch { siJson = []; }
        try { soJson = await soRes.json(); } catch { soJson = []; }
        const parseDevices = (j: any) => {
          if (!j) return [];
          if (Array.isArray(j)) return j;
          if (Array.isArray(j.inputs)) return j.inputs;
          if (Array.isArray(j.outputs)) return j.outputs;
          if (Array.isArray(j.devices)) return j.devices;
          return [];
        };
        const inDevices = parseDevices(siJson);
        const outDevices = parseDevices(soJson);

        const fetched: Stream[] = (sJson.streams || []).map((st: any) => {
          const stream = streamFromBackend(st);
          // Set default network device if not specified
          if (!stream.net_device) {
            stream.net_device = (nJson.interfaces && nJson.interfaces[0]) || '';
          }
          return stream;
        });
        setStreams(fetched);
        setEditStreams(JSON.parse(JSON.stringify(fetched)));
        setNetDevices(nJson.interfaces || []);
        setSoundInputs(inDevices || []);
        setSoundOutputs(outDevices || []);
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleReset = () => { setEditStreams(streams ? JSON.parse(JSON.stringify(streams)) : null); };

  const toggleEdit = (id: string) => setEditingIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const isEditing = (id: string) => editingIds.includes(id);

  const updateStreamField = (idx: number, patch: Partial<Stream>) => {
    if (!editStreams) return;
    const updated = [...editStreams];
    updated[idx] = { ...updated[idx], ...patch };
    setEditStreams(updated);
  };

  const patchStreamObj = async (streamObj: Stream) => {
    try {
      const id = streamObj.id;
      const backendStream = streamToBackend(streamObj);
      const res = await fetch(`${API_BASE_URL}/streams/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(backendStream),
      });
      if (!res.ok) throw new Error(`Failed to patch stream ${id}`);
      const j = await res.json();
      const newStreams = (j.streams || []).map(streamFromBackend);
      setStreams(newStreams);
      setEditStreams(JSON.parse(JSON.stringify(newStreams)));
    } catch (err: any) {
      console.error('patch error', err);
      alert(`Error saving stream: ${err.message}`);
    }
  };





  if (loading) return <div className="card">Loading AES67 status...</div>;
  if (error) return <div className="card error">Error: {error.message}</div>;
  if (!editStreams) return <div className="card">No data available.</div>;

  return (
    <div className="aes67-layout">
      <div className="card">
        <h3>Streams</h3>
        <div className="config-form">
          <div className="streams-card">
            {Array.isArray(editStreams) && editStreams.length > 0 ? (
              (() => {
                const entries = editStreams.map((s, i) => ({ s, i }));
                const transmitters = entries.filter(e => e.s.mode === 'input');
                const receivers = entries.filter(e => e.s.mode === 'output');
                return (
                  <>
                    <section className="streams-section">
                      <h4>Transmitters (Capture)</h4>
                      {transmitters.length > 0 ? transmitters.map(({ s, i }) => (
                        <div key={`tx-${s.id || i}`} className={`stream-card ${s.enabled ? 'active' : ''}`}>
                          <div className="card-body">
                            <div className="stream-line">
                              <div className="stream-left">
                                <button className={`stream-toggle ${s.enabled ? 'enabled' : 'disabled'}`} onClick={() => {
                                  const updatedObj = { ...s, enabled: !s.enabled } as Stream;
                                  updateStreamField(i, { enabled: !s.enabled });
                                  void patchStreamObj(updatedObj);
                                }} aria-pressed={!!s.enabled} title={s.enabled ? 'Stop stream' : 'Start stream'}>
                                  {s.enabled ? <FiSquare size={20} /> : <FiPlay size={20} />}
                                </button>
                                {s.enabled && (
                                  <div className="streaming-indicator" aria-hidden>
                                    <span className="bar b1" />
                                    <span className="bar b2" />
                                    <span className="bar b3" />
                                  </div>
                                )}
                              </div>
                              <div className="stream-center">
                                <div className="stream-id">{s.id}</div>
                                <div className={`stream-direction ${s.mode === 'input' ? 'input' : 'output'}`}>{s.mode === 'input' ? 'Capture' : 'Receive'}</div>
                                {!isEditing(s.id) ? (
                                  <>
                                    <div className="addr-left">
                                      <BsEthernet className="icon-net" />
                                      <span className="addr-net">{s.net_device || <em>(none)</em>}</span>
                                    </div>
                                    <div className="stream-addr">{`${s.addr}:${s.port}`}</div>
                                    <div className="stream-meta">
                                      <span className="stream-meta-item hw-with-icon"><GiSoundWaves className="icon-hw-meta" />{s.hw_device || <em>(none)</em>}</span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="editor-inline">
                                    <select value={s.mode || 'output'} onChange={(e) => {
                                      const val = (e.target as HTMLSelectElement).value as 'input' | 'output';
                                      updateStreamField(i, { mode: val });
                                    }} autoFocus onKeyDown={(e) => { if (e.key === 'Escape') { handleReset(); toggleEdit(s.id); } if (e.key === 'Enter') { void patchStreamObj(editStreams![i]); toggleEdit(s.id); } }}>
                                      <option value="input">Input (Capture)</option>
                                      <option value="output">Output (Receive)</option>
                                    </select>
                                    <select value={s.net_device || ''} onChange={(e) => {
                                      const val = (e.target as HTMLSelectElement).value;
                                      updateStreamField(i, { net_device: val });
                                    }} onKeyDown={(e) => { if (e.key === 'Escape') { handleReset(); toggleEdit(s.id); } if (e.key === 'Enter') { void patchStreamObj(editStreams![i]); toggleEdit(s.id); } }}>
                                      <option value="">(none)</option>
                                      {netDevices.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                    <input className="inline-input" type="text" value={`${s.addr}:${s.port}`} onInput={(e) => {
                                      const [a, p] = (e.target as HTMLInputElement).value.split(':');
                                      updateStreamField(i, { addr: a || '', port: p ? Number(p) : '' });
                                    }} onKeyDown={(e) => { if (e.key === 'Escape') { handleReset(); toggleEdit(s.id); } if (e.key === 'Enter') { void patchStreamObj(editStreams![i]); toggleEdit(s.id); } }} />
                                    <select value={s.hw_device || ''} onChange={(e) => {
                                      const val = (e.target as HTMLSelectElement).value;
                                      updateStreamField(i, { hw_device: val });
                                    }} onKeyDown={(e) => { if (e.key === 'Escape') { handleReset(); toggleEdit(s.id); } if (e.key === 'Enter') { void patchStreamObj(editStreams![i]); toggleEdit(s.id); } }}>
                                      <option value="">(none)</option>
                                      {(s.mode === 'input' ? soundInputs : soundOutputs).map((d: any) => (
                                        <option key={d.card_id || d.card_name} value={d.card_name || d.card_id}>{d.card_name || d.card_id}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                              <div className="stream-right">
                                {!isEditing(s.id) ? (
                                  <button className="icon-button edit" onClick={() => toggleEdit(s.id)} title="Edit">
                                    <FiEdit2 />
                                  </button>
                                ) : (
                                  <>
                                    <button className="icon-button approve" onClick={() => {
                                      void patchStreamObj(editStreams![i]);
                                      toggleEdit(s.id);
                                    }} title="Apply changes">
                                      <FiCheck />
                                    </button>
                                    <button className="icon-button cancel" onClick={() => {
                                      handleReset();
                                      toggleEdit(s.id);
                                    }} title="Cancel">
                                      <FiX />
                                    </button>
                                  </>
                                )}
                                <button className="delete-button" onClick={async () => {
                                  const updated = [...(editStreams || [])];
                                  updated.splice(i, 1);
                                  setEditStreams(updated);
                                  try {
                                    const id = s.id;
                                    const res = await fetch(`${API_BASE_URL}/streams/${encodeURIComponent(id)}`, { method: 'DELETE' });
                                    if (!res.ok) throw new Error('Failed to delete');
                                    const j = await res.json();
                                    const convertedStreams = (j.streams || []).map(streamFromBackend);
                                    setStreams(convertedStreams);
                                    setEditStreams(JSON.parse(JSON.stringify(convertedStreams)));
                                  } catch (err: any) { alert(`Delete error: ${err.message}`); }
                                }} title="Delete"><FiTrash2 size={16} /></button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )) : <div className="muted">No transmitters configured.</div>}
                    </section>

                    <section className="streams-section">
                      <h4>Receivers (Play/Receive)</h4>
                      {receivers.length > 0 ? receivers.map(({ s, i }) => (
                        <div key={`rx-${s.id || i}`} className={`stream-card ${s.enabled ? 'active' : ''}`}>
                          <div className="card-body">
                            <div className="stream-line">
                              <div className="stream-left">
                                <button className={`stream-toggle ${s.enabled ? 'enabled' : 'disabled'}`} onClick={() => {
                                  const updatedObj = { ...s, enabled: !s.enabled } as Stream;
                                  updateStreamField(i, { enabled: !s.enabled });
                                  void patchStreamObj(updatedObj);
                                }} aria-pressed={!!s.enabled} title={s.enabled ? 'Stop stream' : 'Start stream'}>
                                  {s.enabled ? <FiSquare size={20} /> : <FiPlay size={20} />}
                                </button>
                                {s.enabled && (
                                  <div className="streaming-indicator" aria-hidden>
                                    <span className="bar b1" />
                                    <span className="bar b2" />
                                    <span className="bar b3" />
                                  </div>
                                )}
                              </div>
                              <div className="stream-center">
                                <div className="stream-id">{s.id}</div>
                                <div className={`stream-direction ${s.mode === 'input' ? 'input' : 'output'}`}>{s.mode === 'input' ? 'Capture' : 'Receive'}</div>
                                {!isEditing(s.id) ? (
                                  <>
                                    <div className="addr-left">
                                      <BsEthernet className="icon-net" />
                                      <span className="addr-net">{s.net_device || <em>(none)</em>}</span>
                                    </div>
                                    <div className="stream-addr">{`${s.addr}:${s.port}`}</div>
                                    <div className="stream-meta">
                                      <span className="stream-meta-item hw-with-icon"><GiSoundWaves className="icon-hw-meta" />{s.hw_device || <em>(none)</em>}</span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="editor-inline">
                                    <select value={s.mode || 'output'} onChange={(e) => {
                                      const val = (e.target as HTMLSelectElement).value as 'input' | 'output';
                                      updateStreamField(i, { mode: val });
                                    }} autoFocus onKeyDown={(e) => { if (e.key === 'Escape') { handleReset(); toggleEdit(s.id); } if (e.key === 'Enter') { void patchStreamObj(editStreams![i]); toggleEdit(s.id); } }}>
                                      <option value="input">Input (Capture)</option>
                                      <option value="output">Output (Receive)</option>
                                    </select>
                                    <select value={s.net_device || ''} onChange={(e) => {
                                      const val = (e.target as HTMLSelectElement).value;
                                      updateStreamField(i, { net_device: val });
                                    }} onKeyDown={(e) => { if (e.key === 'Escape') { handleReset(); toggleEdit(s.id); } if (e.key === 'Enter') { void patchStreamObj(editStreams![i]); toggleEdit(s.id); } }}>
                                      <option value="">(none)</option>
                                      {netDevices.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                    <input className="inline-input" type="text" value={`${s.addr}:${s.port}`} onInput={(e) => {
                                      const [a, p] = (e.target as HTMLInputElement).value.split(':');
                                      updateStreamField(i, { addr: a || '', port: p ? Number(p) : '' });
                                    }} onKeyDown={(e) => { if (e.key === 'Escape') { handleReset(); toggleEdit(s.id); } if (e.key === 'Enter') { void patchStreamObj(editStreams![i]); toggleEdit(s.id); } }} />
                                    <select value={s.hw_device || ''} onChange={(e) => {
                                      const val = (e.target as HTMLSelectElement).value;
                                      updateStreamField(i, { hw_device: val });
                                    }} onKeyDown={(e) => { if (e.key === 'Escape') { handleReset(); toggleEdit(s.id); } if (e.key === 'Enter') { void patchStreamObj(editStreams![i]); toggleEdit(s.id); } }}>
                                      <option value="">(none)</option>
                                      {(s.mode === 'input' ? soundInputs : soundOutputs).map((d: any) => (
                                        <option key={d.card_id || d.card_name} value={d.card_name || d.card_id}>{d.card_name || d.card_id}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                              <div className="stream-right">
                                {!isEditing(s.id) ? (
                                  <button className="icon-button edit" onClick={() => toggleEdit(s.id)} title="Edit">
                                    <FiEdit2 />
                                  </button>
                                ) : (
                                  <>
                                    <button className="icon-button approve" onClick={() => {
                                      void patchStreamObj(editStreams![i]);
                                      toggleEdit(s.id);
                                    }} title="Apply changes">
                                      <FiCheck />
                                    </button>
                                    <button className="icon-button cancel" onClick={() => {
                                      handleReset();
                                      toggleEdit(s.id);
                                    }} title="Cancel">
                                      <FiX />
                                    </button>
                                  </>
                                )}
                                <button className="delete-button" onClick={async () => {
                                  const updated = [...(editStreams || [])];
                                  updated.splice(i, 1);
                                  setEditStreams(updated);
                                  try {
                                    const id = s.id;
                                    const res = await fetch(`${API_BASE_URL}/streams/${encodeURIComponent(id)}`, { method: 'DELETE' });
                                    if (!res.ok) throw new Error('Failed to delete');
                                    const j = await res.json();
                                    const convertedStreams = (j.streams || []).map(streamFromBackend);
                                    setStreams(convertedStreams);
                                    setEditStreams(JSON.parse(JSON.stringify(convertedStreams)));
                                  } catch (err: any) { alert(`Delete error: ${err.message}`); }
                                }} title="Delete"><FiTrash2 size={16} /></button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )) : <div className="muted">No receivers configured.</div>}
                    </section>
                  </>
                );
              })()
            ) : (
              <div>No streams configured.</div>
            )}

            <div className="stream-actions">
              <button className="button-secondary" onClick={async () => {
                // Create new stream on the server with disabled state so user can configure it first
                const newStream: Partial<Stream> = {
                  mode: 'output',
                  addr: '239.69.22.10',
                  port: 5004,
                  hw_device: '',
                  net_device: (netDevices[0] || ''),
                  enabled: false
                };
                const backendPayload = streamToBackend(newStream);
                try {
                  const res = await fetch(`${API_BASE_URL}/streams/`, {
                    method: 'POST',
                    headers: { accept: 'application/json', 'Content-Type': 'application/json' },
                    body: JSON.stringify(backendPayload),
                  });
                  if (!res.ok) throw new Error('Failed to create stream');
                  const j = await res.json();
                  const updatedStreams: Stream[] = (j.streams || []).map(streamFromBackend);
                  setStreams(updatedStreams);
                  setEditStreams(JSON.parse(JSON.stringify(updatedStreams)));
                  // open editor for the newly created stream (last one)
                  const created = updatedStreams[updatedStreams.length - 1];
                  if (created && created.id) toggleEdit(created.id as string);
                } catch (err: any) {
                  alert(`Create stream failed: ${err.message}`);
                }
              }}>Add stream</button>
            </div>

            {/* Reset removed: per-row cancel/reload uses Escape and immediate PATCH/POST flows */}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Aes67;
