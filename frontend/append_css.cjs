const fs = require('fs');
const css = `
/* ==========================================================================
   BILLING DASHBOARD STYLES
   ========================================================================== */

.billing-container {
  display: flex;
  flex-direction: column;
  position: relative;
  flex: 1;
  min-height: 0;
}

.billing-content-wrapper {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
}

.billing-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
  flex-shrink: 0;
}

.billing-title-box h2 {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 8px;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}

.billing-title-box p {
  margin: 0;
  color: var(--color-text-secondary);
}

.billing-btn-export {
  padding: 10px 18px;
  background: var(--color-success);
  color: #fff;
  border: none;
  border-radius: var(--border-radius-md);
  cursor: pointer;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all var(--transition-fast);
}

.billing-btn-export:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md), 0 4px 12px color-mix(in srgb, var(--color-success) 20%, transparent);
  filter: brightness(1.05);
}

.billing-filters-bar {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-lg);
  padding: 20px;
  margin-bottom: 24px;
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  align-items: flex-end;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
  backdrop-filter: var(--glass-blur);
}

.billing-filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 180px;
}

.billing-filter-group label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.billing-filter-input {
  padding: 10px 14px;
  border-radius: var(--border-radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-text-primary);
  outline: none;
  transition: all var(--transition-fast);
  color-scheme: dark;
}

.billing-filter-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
}

.billing-btn-filter {
  padding: 11px 20px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--border-radius-md);
  cursor: pointer;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all var(--transition-fast);
}

.billing-btn-filter:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md), 0 4px 12px color-mix(in srgb, var(--color-primary) 20%, transparent);
  filter: brightness(1.08);
}

.billing-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
  margin-bottom: 24px;
  flex-shrink: 0;
}

.billing-kpi-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-sm);
  backdrop-filter: var(--glass-blur);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.billing-kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.billing-kpi-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.billing-kpi-value {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
}

.billing-kpi-value.api-cost { color: var(--color-error); }
.billing-kpi-value.billed { color: var(--color-primary); }
.billing-kpi-value.margin { color: var(--color-success); }

.billing-table-wrapper {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-lg);
  overflow-x: auto;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  box-shadow: var(--shadow-sm);
  backdrop-filter: var(--glass-blur);
}

.billing-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  text-align: left;
  font-size: 13px;
  color: var(--color-text-primary);
}

.billing-th {
  padding: 16px;
  font-weight: 600;
  background: color-mix(in srgb, var(--color-surface) 90%, black);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 1;
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.02em;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.billing-tr {
  transition: background var(--transition-fast);
}

.billing-tr:hover {
  background: color-mix(in srgb, var(--color-primary) 3%, transparent);
}

.billing-td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}

.billing-tr:last-child .billing-td {
  border-bottom: none;
}

.billing-empty-state {
  padding: 40px;
  text-align: center;
  color: var(--color-text-secondary);
}

.billing-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.billing-badge.source-copilot {
  background: color-mix(in srgb, #a78bfa 15%, transparent);
  color: #c4b5fd;
  border: 1px solid color-mix(in srgb, #a78bfa 30%, transparent);
}

.billing-badge.source-assist {
  background: color-mix(in srgb, #38bdf8 15%, transparent);
  color: #7dd3fc;
  border: 1px solid color-mix(in srgb, #38bdf8 30%, transparent);
}

.billing-badge.source-other {
  background: color-mix(in srgb, var(--color-text-secondary) 15%, transparent);
  color: var(--color-text-secondary);
  border: 1px solid color-mix(in srgb, var(--color-text-secondary) 30%, transparent);
}

.billing-badge.provider {
  background: var(--color-border);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  margin-right: 8px;
  border-radius: 6px;
  font-size: 10px;
}
`;
fs.appendFileSync('c:/Users/vlevi/OneDrive/Documentos/antigravity/GIT/Kuden-IA/kuden-ia/frontend/src/index.css', css, 'utf8');
console.log('Successfully appended CSS');
