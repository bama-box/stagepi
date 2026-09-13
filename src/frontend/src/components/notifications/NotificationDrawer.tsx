import { useState, useEffect } from 'preact/hooks';
import { useNotification, type NotificationItem } from '../../context/NotificationContext';
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiInfo,
  FiX,
  FiChevronDown,
  FiChevronRight,
  FiCopy,
  FiCheck,
  FiFileText,
  FiTrash2,
  FiRefreshCw,
} from 'react-icons/fi';
import { API_BASE_URL } from '../../config';
import { ansiToHtml, stripAnsi } from '../../utils/ansi';
import './NotificationDrawer.css';

type FilterType = 'all' | 'error' | 'warning' | 'info';

interface StreamLogData {
  stream_id: string;
  status?: string;
  stdout?: string;
  stderr?: string;
}

export function NotificationDrawer() {
  const {
    notifications,
    isDrawerOpen,
    closeDrawer,
    focusedNotificationId,
    activeLogStreamId,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    closeStreamLogs,
  } = useNotification();

  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedLog, setCopiedLog] = useState(false);
  const [ansiMode, setAnsiMode] = useState<'color' | 'plain'>('color');


  // Stream Log Viewer state
  const [inspectingStreamId, setInspectingStreamId] = useState<string | null>(null);
  const [streamLogs, setStreamLogs] = useState<StreamLogData | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [activeLogTab, setActiveLogTab] = useState<'stderr' | 'stdout'>('stderr');

  // System Journal state
  const [inspectingSystemLogs, setInspectingSystemLogs] = useState(false);
  const [systemLogs, setSystemLogs] = useState<string | null>(null);
  const [loadingSystemLogs, setLoadingSystemLogs] = useState(false);

  // Sync activeLogStreamId from context if triggered externally
  useEffect(() => {
    if (activeLogStreamId) {
      setInspectingStreamId(activeLogStreamId);
      fetchStreamLogs(activeLogStreamId);
      closeStreamLogs();
    }
  }, [activeLogStreamId, closeStreamLogs]);

  // Auto-expand focused notification
  useEffect(() => {
    if (focusedNotificationId) {
      setExpandedIds((prev) => ({ ...prev, [focusedNotificationId]: true }));
      // Scroll to element if possible
      setTimeout(() => {
        const el = document.getElementById(`notif-item-${focusedNotificationId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [focusedNotificationId]);

  if (!isDrawerOpen) return null;

  const toggleExpand = (id: string) => {
    markAsRead(id);
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (item: NotificationItem) => {
    const cleanMsg = stripAnsi(item.message);
    const cleanDetails = item.details ? stripAnsi(item.details) : '';
    const textToCopy = `[${item.type.toUpperCase()}] ${item.title}\nSource: ${item.source || 'Unknown'}\nTime: ${item.timestamp}\nMessage: ${cleanMsg}${cleanDetails ? `\nDetails:\n${cleanDetails}` : ''}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleCopyCurrentLog = (content: string) => {
    navigator.clipboard.writeText(stripAnsi(content)).then(() => {
      setCopiedLog(true);
      setTimeout(() => setCopiedLog(false), 2000);
    });
  };

  const fetchStreamLogs = async (streamId: string) => {
    setLoadingLogs(true);
    setLogError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/streams/${encodeURIComponent(streamId)}/logs?lines=100`);
      if (!res.ok) {
        throw new Error(`Failed to fetch logs (HTTP ${res.status})`);
      }
      const data: StreamLogData = await res.json();
      setStreamLogs(data);
      // Auto-switch to stderr if it has content, else stdout
      if (data.stderr && data.stderr.trim().length > 0) {
        setActiveLogTab('stderr');
      } else {
        setActiveLogTab('stdout');
      }
    } catch (err: any) {
      setLogError(err.message || 'Error fetching stream logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleOpenStreamLogs = (streamId: string) => {
    setInspectingStreamId(streamId);
    setInspectingSystemLogs(false);
    fetchStreamLogs(streamId);
  };

  const fetchSystemLogs = async () => {
    setLoadingSystemLogs(true);
    try {
      const res = await fetch(`${API_BASE_URL}/system/logs?service=stagepi-ui&lines=60`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSystemLogs(data.logs || 'No logs found.');
    } catch (err: any) {
      setSystemLogs(`Failed to fetch system journal: ${err.message}`);
    } finally {
      setLoadingSystemLogs(false);
    }
  };

  const handleOpenSystemLogs = () => {
    setInspectingSystemLogs(true);
    setInspectingStreamId(null);
    fetchSystemLogs();
  };

  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'error') return item.type === 'error';
    if (filter === 'warning') return item.type === 'warning';
    if (filter === 'info') return item.type === 'info' || item.type === 'success';
    return true;
  });

  const errorCount = notifications.filter((n) => n.type === 'error').length;
  const warningCount = notifications.filter((n) => n.type === 'warning').length;
  const infoCount = notifications.filter((n) => n.type === 'info' || n.type === 'success').length;

  return (
    <div className="drawer-overlay" onClick={closeDrawer}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-title-group">
            <h2 className="drawer-title">Event & Error Center</h2>
            {notifications.length > 0 && (
              <span className="drawer-count-badge">
                {notifications.length} {notifications.length === 1 ? 'event' : 'events'}
              </span>
            )}
          </div>
          <div className="drawer-header-actions">
            {notifications.length > 0 && (
              <>
                <button
                  type="button"
                  className="drawer-action-link"
                  onClick={markAllAsRead}
                  title="Mark all events as read"
                >
                  Mark read
                </button>
                <button
                  type="button"
                  className="drawer-action-link clear-btn"
                  onClick={clearAll}
                  title="Clear all events"
                >
                  <FiTrash2 size={13} /> Clear
                </button>
              </>
            )}
            <button
              type="button"
              className="drawer-close-btn"
              onClick={closeDrawer}
              aria-label="Close drawer"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        {/* Filter Navigation */}
        <div className="drawer-filters">
          <button
            type="button"
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All <span className="filter-count">{notifications.length}</span>
          </button>
          <button
            type="button"
            className={`filter-btn filter-error ${filter === 'error' ? 'active' : ''}`}
            onClick={() => setFilter('error')}
          >
            Errors <span className="filter-count">{errorCount}</span>
          </button>
          <button
            type="button"
            className={`filter-btn filter-warning ${filter === 'warning' ? 'active' : ''}`}
            onClick={() => setFilter('warning')}
          >
            Warnings <span className="filter-count">{warningCount}</span>
          </button>
          <button
            type="button"
            className={`filter-btn ${filter === 'info' ? 'active' : ''}`}
            onClick={() => setFilter('info')}
          >
            Info <span className="filter-count">{infoCount}</span>
          </button>
        </div>

        {/* Stream Log Inspection Modal / Panel */}
        {inspectingStreamId && (
          <div className="log-viewer-container">
            <div className="log-viewer-header">
              <div className="log-viewer-title">
                <FiFileText size={16} />
                <span>Supervisor Stream Logs: <strong>{inspectingStreamId}</strong></span>
                {streamLogs?.status && <span className="log-status-tag">{stripAnsi(streamLogs.status)}</span>}
              </div>
              <div className="log-viewer-controls">
                <button
                  type="button"
                  className={`log-ansi-toggle-btn ${ansiMode === 'color' ? 'active' : ''}`}
                  onClick={() => setAnsiMode((prev) => (prev === 'color' ? 'plain' : 'color'))}
                  title="Toggle ANSI color / plain text"
                >
                  {ansiMode === 'color' ? 'Color' : 'Plain'}
                </button>
                <button
                  type="button"
                  className="log-copy-action-btn"
                  onClick={() =>
                    handleCopyCurrentLog(
                      activeLogTab === 'stderr' ? streamLogs?.stderr || '' : streamLogs?.stdout || ''
                    )
                  }
                  title="Copy log to clipboard (clean text)"
                >
                  {copiedLog ? <FiCheck size={12} color="#10b981" /> : <FiCopy size={12} />}
                  <span>{copiedLog ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  className="log-refresh-btn"
                  onClick={() => fetchStreamLogs(inspectingStreamId)}
                  disabled={loadingLogs}
                  title="Refresh logs"
                >
                  <FiRefreshCw size={13} className={loadingLogs ? 'spin' : ''} />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  className="log-close-btn"
                  onClick={() => {
                    setInspectingStreamId(null);
                    setStreamLogs(null);
                  }}
                  title="Close log viewer"
                >
                  <FiX size={15} />
                </button>
              </div>
            </div>

            <div className="log-tabs">
              <button
                type="button"
                className={`log-tab-btn ${activeLogTab === 'stderr' ? 'active' : ''}`}
                onClick={() => setActiveLogTab('stderr')}
              >
                Error Log (stderr)
                {streamLogs?.stderr && streamLogs.stderr.trim().length > 0 && (
                  <span className="log-badge-alert">!</span>
                )}
              </button>
              <button
                type="button"
                className={`log-tab-btn ${activeLogTab === 'stdout' ? 'active' : ''}`}
                onClick={() => setActiveLogTab('stdout')}
              >
                Output Log (stdout)
              </button>
            </div>

            <div className="log-console">
              {loadingLogs ? (
                <div className="log-loading">Fetching logs from supervisor...</div>
              ) : logError ? (
                <div className="log-error-text">{logError}</div>
              ) : (
                <div
                  className="log-console-content"
                  dangerouslySetInnerHTML={{
                    __html:
                      ansiMode === 'color'
                        ? ansiToHtml(
                            activeLogTab === 'stderr'
                              ? streamLogs?.stderr || '(No stderr output recorded)'
                              : streamLogs?.stdout || '(No stdout output recorded)'
                          )
                        : `<pre style="margin:0;white-space:pre-wrap;word-break:break-all;">${stripAnsi(
                            activeLogTab === 'stderr'
                              ? streamLogs?.stderr || '(No stderr output recorded)'
                              : streamLogs?.stdout || '(No stdout output recorded)'
                          )}</pre>`,
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* System Journal Inspection */}
        {inspectingSystemLogs && (
          <div className="log-viewer-container">
            <div className="log-viewer-header">
              <div className="log-viewer-title">
                <FiFileText size={16} />
                <span>Service Journal (stagepi-ui)</span>
              </div>
              <div className="log-viewer-controls">
                <button
                  type="button"
                  className={`log-ansi-toggle-btn ${ansiMode === 'color' ? 'active' : ''}`}
                  onClick={() => setAnsiMode((prev) => (prev === 'color' ? 'plain' : 'color'))}
                  title="Toggle ANSI color / plain text"
                >
                  {ansiMode === 'color' ? 'Color' : 'Plain'}
                </button>
                <button
                  type="button"
                  className="log-copy-action-btn"
                  onClick={() => handleCopyCurrentLog(systemLogs || '')}
                  title="Copy journal to clipboard"
                >
                  {copiedLog ? <FiCheck size={12} color="#10b981" /> : <FiCopy size={12} />}
                  <span>{copiedLog ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  className="log-refresh-btn"
                  onClick={fetchSystemLogs}
                  disabled={loadingSystemLogs}
                >
                  <FiRefreshCw size={13} className={loadingSystemLogs ? 'spin' : ''} />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  className="log-close-btn"
                  onClick={() => setInspectingSystemLogs(false)}
                >
                  <FiX size={15} />
                </button>
              </div>
            </div>
            <div className="log-console">
              {loadingSystemLogs ? (
                <div className="log-loading">Fetching system journal...</div>
              ) : (
                <div
                  className="log-console-content"
                  dangerouslySetInnerHTML={{
                    __html:
                      ansiMode === 'color'
                        ? ansiToHtml(systemLogs || 'No logs available')
                        : `<pre style="margin:0;white-space:pre-wrap;word-break:break-all;">${stripAnsi(
                            systemLogs || 'No logs available'
                          )}</pre>`,
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* Notifications List */}
        <div className="drawer-content">
          {filteredNotifications.length === 0 ? (
            <div className="drawer-empty-state">
              <FiCheckCircle size={44} className="empty-state-icon" />
              <h3>All Quiet</h3>
              <p>No {filter !== 'all' ? filter : ''} events or errors recorded.</p>
              <button
                type="button"
                className="system-log-quick-btn"
                onClick={handleOpenSystemLogs}
              >
                <FiFileText size={14} /> View Service Journal
              </button>
            </div>
          ) : (
            filteredNotifications.map((item) => {
              const isExpanded = !!expandedIds[item.id];
              let Icon = FiInfo;
              if (item.type === 'error') Icon = FiAlertCircle;
              else if (item.type === 'warning') Icon = FiAlertTriangle;
              else if (item.type === 'success') Icon = FiCheckCircle;

              const timeStr = new Date(item.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <div
                  key={item.id}
                  id={`notif-item-${item.id}`}
                  className={`event-card event-${item.type} ${!item.read ? 'unread' : ''}`}
                  onClick={() => markAsRead(item.id)}
                >
                  <div className="event-card-top">
                    <div className="event-icon-badge">
                      <Icon size={16} />
                    </div>

                    <div className="event-header-info">
                      <div className="event-meta">
                        {item.source && <span className="event-source">{item.source}</span>}
                        <span className="event-time">{timeStr}</span>
                        {!item.read && <span className="unread-indicator" title="Unread event" />}
                      </div>
                      <h4 className="event-title">{item.title}</h4>
                    </div>

                    <button
                      type="button"
                      className="event-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNotification(item.id);
                      }}
                      title="Remove event"
                    >
                      <FiX size={14} />
                    </button>
                  </div>

                  <p className="event-message">{item.message}</p>

                  {/* Actions & Drill-Downs */}
                  <div className="event-actions-row">
                    {item.details && (
                      <button
                        type="button"
                        className="event-toggle-details-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(item.id);
                        }}
                      >
                        {isExpanded ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                        <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                      </button>
                    )}

                    {item.streamId && (
                      <button
                        type="button"
                        className="event-log-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenStreamLogs(item.streamId!);
                        }}
                      >
                        <FiFileText size={13} />
                        <span>Stream Logs ({item.streamId})</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="event-copy-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(item);
                      }}
                      title="Copy event data to clipboard"
                    >
                      {copiedId === item.id ? (
                        <>
                          <FiCheck size={12} color="#10b981" />
                          <span style={{ color: '#10b981' }}>Copied</span>
                        </>
                      ) : (
                        <>
                          <FiCopy size={12} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Expanded Technical Details */}
                  {isExpanded && item.details && (
                    <div className="event-expanded-details">
                      <pre className="details-raw">{stripAnsi(item.details)}</pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        <div className="drawer-footer">
          <button
            type="button"
            className="system-journal-btn"
            onClick={handleOpenSystemLogs}
          >
            <FiFileText size={14} />
            <span>Inspect UI Service Journal</span>
          </button>
        </div>
      </div>
    </div>
  );
}
