import React, { Children, createContext, forwardRef, isValidElement, useContext, useEffect, useId, useRef, useState } from 'react';

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

export const Input = forwardRef(function Input({ contentBefore, contentAfter, onChange, className, size, ...props }, ref) {
  const input = (
    <input
      ref={ref}
      className={join('form-control', size === 'large' && 'form-control-lg', className)}
      onChange={(event) => onChange?.(event, { value: event.target.value })}
      {...props}
    />
  );
  if (!contentBefore && !contentAfter) return input;
  return (
    <div className="input-group">
      {contentBefore && <span className="input-group-text" aria-hidden="true">{contentBefore}</span>}
      {input}
      {contentAfter && <span className="input-group-text input-group-text--after">{contentAfter}</span>}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ onChange, className, resize, ...props }, ref) {
  return <textarea ref={ref} className={join('form-control', className)} onChange={(event) => onChange?.(event, { value: event.target.value })} {...props} />;
});

export const Select = forwardRef(function Select({ className, children, style, value, onChange, disabled, name, ...props }, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const selectId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  const parseOpts = (kids) => {
    const opts = [];
    Children.forEach(kids, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === React.Fragment) {
        opts.push(...parseOpts(child.props.children));
      } else if (child.type === 'option' || child.props?.value !== undefined || child.props?.children !== undefined) {
        opts.push({
          value: child.props.value ?? child.props.children ?? '',
          label: child.props.children ?? '',
          disabled: child.props.disabled
        });
      }
    });
    return opts;
  };

  const options = parseOpts(children);
  const selectedOption = options.find(o => String(o.value) === String(value ?? ''));
  const selectedIndex = options.findIndex(o => String(o.value) === String(value ?? ''));
  const displayLabel = selectedOption ? selectedOption.label : (options[0]?.label || 'Chọn...');
  const listboxId = `${selectId}-listbox`;
  const activeOptionId = activeIndex >= 0 ? `${selectId}-option-${activeIndex}` : undefined;

  function enabledOptionIndex(startIndex, direction = 1) {
    if (!options.length) return -1;
    for (let offset = 0; offset < options.length; offset += 1) {
      const index = (startIndex + offset * direction + options.length) % options.length;
      if (!options[index]?.disabled) return index;
    }
    return -1;
  }

  function openMenu(nextIndex = selectedIndex) {
    if (disabled) return;
    const fallbackIndex = nextIndex >= 0 ? nextIndex : 0;
    setActiveIndex(enabledOptionIndex(fallbackIndex));
    setIsOpen(true);
  }

  function chooseOption(option) {
    if (!option || option.disabled) return;
    onChange?.({
      target: { value: option.value, name },
      currentTarget: { value: option.value, name },
      preventDefault: () => {},
      stopPropagation: () => {}
    });
    setIsOpen(false);
  }

  function handleComboboxKeyDown(event) {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        openMenu(selectedIndex);
        return;
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const startIndex = activeIndex >= 0 ? activeIndex + direction : selectedIndex + direction;
      setActiveIndex(enabledOptionIndex(startIndex, direction));
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isOpen) openMenu(selectedIndex);
      else chooseOption(options[activeIndex]);
      return;
    }
    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  }

  return (
    <div className="custom-select-container" ref={containerRef} style={style}>
      <select
        ref={ref}
        value={value}
        onChange={onChange}
        disabled={disabled}
        name={name}
        className="custom-select-native-hidden"
        tabIndex={-1}
        aria-hidden="true"
        {...props}
      >
        {children}
      </select>

      <div
        className={join('form-select', isOpen && 'form-select--open', disabled && 'disabled', className)}
        onClick={() => {
          if (disabled) return;
          if (isOpen) setIsOpen(false);
          else openMenu(selectedIndex);
        }}
        onKeyDown={handleComboboxKeyDown}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={isOpen ? activeOptionId : undefined}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
      >
        <span className="custom-select__value">{displayLabel}</span>
      </div>

      {isOpen && !disabled && (
        <div className="custom-select__menu" id={listboxId} role="listbox">
          {options.map((opt, idx) => {
            const isSel = String(opt.value) === String(value ?? '');
            const isActive = idx === activeIndex;
            return (
              <div
                key={idx}
                id={`${selectId}-option-${idx}`}
                role="option"
                aria-selected={isSel}
                className={join(
                  'custom-select__item',
                  isSel && 'custom-select__item--selected',
                  isActive && 'custom-select__item--active',
                  opt.disabled && 'custom-select__item--disabled'
                )}
                onMouseEnter={() => !opt.disabled && setActiveIndex(idx)}
                onClick={() => chooseOption(opt)}
              >
                <span className="custom-select__option-label">{opt.label}</span>
                {isSel && <span className="custom-select__item-check">✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
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
  return <DialogContext.Provider value={{ close }}><div className="modal fade show custom-modal-backdrop-flex" role="dialog" aria-modal="true" onMouseDown={(event) => event.target === event.currentTarget && close(event)}>{children}</div><div className="modal-backdrop fade show" /></DialogContext.Provider>;
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

export function Avatar({ className, size, icon, imageUrl, 'aria-label': ariaLabel }) {
  const style = size ? { width: size, height: size } : {};
  if (imageUrl) {
    style.backgroundImage = `url(${imageUrl})`;
    style.backgroundSize = 'cover';
    style.backgroundPosition = 'center';
    style.color = 'transparent';
  }
  return <span className={join('app-avatar', className)} style={style} aria-label={ariaLabel}>{!imageUrl && icon}</span>;
}

// Kept as lightweight aliases while old page markup is migrated.
export const Combobox = Select;
export function Option({ children, ...props }) { return <option {...props}>{children}</option>; }
