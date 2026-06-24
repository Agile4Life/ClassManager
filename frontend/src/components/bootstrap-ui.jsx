import { createContext, forwardRef, useContext, useEffect } from 'react';

function join(...values) {
  return values.filter(Boolean).join(' ');
}

const buttonStyles = {
  primary: 'btn-primary',
  secondary: 'btn-outline-secondary',
  subtle: 'btn-light',
  transparent: 'btn-link',
};

export function Button({ as: Component = 'button', appearance = 'secondary', size, icon, iconPosition = 'before', className, children, type, ...props }) {
  const iconOnly = icon && !children;
  return (
    <Component
      type={Component === 'button' ? (type || 'button') : undefined}
      className={join('btn', buttonStyles[appearance] || 'btn-outline-secondary', size === 'small' && 'btn-sm', iconOnly && 'btn-icon', className)}
      {...props}
    >
      {icon && iconPosition !== 'after' && <span className="btn__icon" aria-hidden="true">{icon}</span>}
      {children && <span>{children}</span>}
      {icon && iconPosition === 'after' && <span className="btn__icon" aria-hidden="true">{icon}</span>}
    </Component>
  );
}

export const Input = forwardRef(function Input({ contentBefore, onChange, className, size, ...props }, ref) {
  const input = (
    <input
      ref={ref}
      className={join('form-control', size === 'large' && 'form-control-lg', className)}
      onChange={(event) => onChange?.(event, { value: event.target.value })}
      {...props}
    />
  );
  if (!contentBefore) return input;
  return <div className="input-group"><span className="input-group-text" aria-hidden="true">{contentBefore}</span>{input}</div>;
});

export const Textarea = forwardRef(function Textarea({ onChange, className, resize, ...props }, ref) {
  return <textarea ref={ref} className={join('form-control', className)} onChange={(event) => onChange?.(event, { value: event.target.value })} {...props} />;
});

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return <select ref={ref} className={join('form-select', className)} {...props}>{children}</select>;
});

export function Field({ label, hint, required, className, children }) {
  return (
    <label className={join('form-field', className)}>
      {label && <span className="form-label">{label}{required && <span className="required-mark" aria-hidden="true">*</span>}</span>}
      {children}
      {hint && <span className="form-text">{hint}</span>}
    </label>
  );
}

const DialogContext = createContext(null);

export function Dialog({ open, onOpenChange, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => event.key === 'Escape' && onOpenChange?.(event, { open: false });
    document.addEventListener('keydown', closeOnEscape);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.classList.remove('modal-open');
    };
  }, [open, onOpenChange]);
  if (!open) return null;
  const close = (event) => onOpenChange?.(event, { open: false });
  return <DialogContext.Provider value={{ close }}><div className="modal fade show d-block" role="dialog" aria-modal="true" onMouseDown={(event) => event.target === event.currentTarget && close(event)}>{children}</div><div className="modal-backdrop fade show" /></DialogContext.Provider>;
}

export function DialogSurface({ className, children }) {
  const context = useContext(DialogContext);
  return (
    <div className={join('modal-dialog modal-dialog-centered modal-dialog-scrollable', className)} onMouseDown={(event) => event.target === event.currentTarget && context?.close(event)}>
      {children}
    </div>
  );
}

export function DialogBody({ children }) { return <div className="modal-content">{children}</div>; }
export function DialogTitle({ children }) { return <h2 className="modal-title h5">{children}</h2>; }
export function DialogContent({ className, children }) { return <div className={join('modal-body', className)}>{children}</div>; }
export function DialogActions({ children }) { return <div className="modal-footer">{children}</div>; }

export function MessageBar({ intent = 'info', className, children }) {
  const tone = { error: 'danger', success: 'success', warning: 'warning', info: 'info' }[intent] || 'info';
  return <div className={join('alert', `alert-${tone}`, 'd-flex align-items-start gap-3', className)} role="alert">{children}</div>;
}
export function MessageBarBody({ children }) { return <div className="alert-body flex-grow-1">{children}</div>; }
export function MessageBarTitle({ children }) { return <strong className="alert-heading d-block mb-1">{children}</strong>; }

export function Badge({ color = 'informative', appearance, className, children }) {
  const tone = { success: 'success', warning: 'warning', danger: 'danger', informative: 'primary', subtle: 'secondary', brand: 'primary' }[color] || 'secondary';
  return <span className={join('badge', appearance === 'filled' ? `text-bg-${tone}` : `badge-soft-${tone}`, className)}>{children}</span>;
}

export function Table({ className, children, ...props }) { return <table className={join('table table-hover align-middle mb-0', className)} {...props}>{children}</table>; }
export function TableHeader({ children }) { return <thead>{children}</thead>; }
export function TableBody({ children }) { return <tbody>{children}</tbody>; }
export function TableRow({ children, className, ...props }) { return <tr className={className} {...props}>{children}</tr>; }
export function TableHeaderCell({ children, className, ...props }) { return <th scope="col" className={className} {...props}>{children}</th>; }
export function TableCell({ children, className, ...props }) { return <td className={className} {...props}>{children}</td>; }

export function Checkbox({ label, checked, onChange, className, ...props }) {
  return <label className={join('form-check', className)}><input className="form-check-input" type="checkbox" checked={checked} onChange={(event) => onChange?.(event, { checked: event.target.checked })} {...props} />{label && <span className="form-check-label">{label}</span>}</label>;
}
export function Radio({ label, className, ...props }) {
  return <label className={join('form-check', className)}><input className="form-check-input" type="radio" {...props} />{label && <span className="form-check-label">{label}</span>}</label>;
}
export function TableSelectionCell({ checked, onChange }) {
  return <td className="selection-cell"><input className="form-check-input" type="checkbox" aria-label="Chọn dòng" checked={checked} onChange={onChange} /></td>;
}

const TabsContext = createContext(null);
export function TabList({ selectedValue, onTabSelect, className, children }) {
  return <TabsContext.Provider value={{ selectedValue, onTabSelect }}><div className={join('nav nav-pills', className)} role="tablist">{children}</div></TabsContext.Provider>;
}
export function Tab({ value, children }) {
  const tabs = useContext(TabsContext);
  const active = tabs?.selectedValue === value;
  return <button className={join('nav-link', active && 'active')} type="button" role="tab" aria-selected={active} onClick={(event) => tabs?.onTabSelect?.(event, { value })}>{children}</button>;
}

export function Skeleton({ children }) { return <div className="placeholder-glow">{children}</div>; }
export function SkeletonItem({ className }) { return <span className={join('placeholder', className)} />; }

export function Avatar({ className, size, icon, 'aria-label': ariaLabel }) {
  return <span className={join('app-avatar', className)} style={size ? { width: size, height: size } : undefined} aria-label={ariaLabel}>{icon}</span>;
}

// Kept as lightweight aliases while old page markup is migrated.
export const Combobox = Select;
export function Option({ children, ...props }) { return <option {...props}>{children}</option>; }
