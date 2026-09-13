import { useNotification } from '../../context/NotificationContext';
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiInfo, FiX, FiExternalLink } from 'react-icons/fi';
import './ToastContainer.css';

export function ToastContainer() {
  const { activeToasts, dismissToast, openDrawer } = useNotification();

  if (activeToasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {activeToasts.map((toast) => {
        let Icon = FiInfo;
        if (toast.type === 'error') Icon = FiAlertCircle;
        else if (toast.type === 'warning') Icon = FiAlertTriangle;
        else if (toast.type === 'success') Icon = FiCheckCircle;

        return (
          <div key={toast.id} className={`toast-card toast-${toast.type}`}>
            <div className="toast-icon-wrapper">
              <Icon size={20} className="toast-icon" />
            </div>
            <div className="toast-body">
              <div className="toast-header">
                <span className="toast-title">{toast.title}</span>
                {toast.source && <span className="toast-source">{toast.source}</span>}
              </div>
              <p className="toast-message">{toast.message}</p>
              {(toast.details || toast.streamId) && (
                <button
                  type="button"
                  className="toast-action-btn"
                  onClick={() => openDrawer(toast.id)}
                >
                  <FiExternalLink size={12} />
                  <span>Inspect Details</span>
                </button>
              )}
            </div>
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss toast"
            >
              <FiX size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
