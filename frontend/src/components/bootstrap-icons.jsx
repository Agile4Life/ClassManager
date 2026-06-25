function Icon({ name, className, ...props }) {
  return <i className={`bi bi-${name}${className ? ` ${className}` : ''}`} {...props} />;
}

export const Add24Regular = (props) => <Icon name="plus-lg" {...props} />;
export const ArrowClockwise24Regular = (props) => <Icon name="arrow-clockwise" {...props} />;
export const ArrowRight24Regular = (props) => <Icon name="arrow-right" {...props} />;
export const BookOpen24Filled = (props) => <Icon name="mortarboard-fill" {...props} />;
export const CalendarLtr24Regular = (props) => <Icon name="calendar3" {...props} />;
export const ChevronLeft24Regular = (props) => <Icon name="chevron-left" {...props} />;
export const ChevronRight24Regular = (props) => <Icon name="chevron-right" {...props} />;
export const Camera24Regular = (props) => <Icon name="camera" {...props} />;
export const Copy24Regular = (props) => <Icon name="copy" {...props} />;
export const DataTrending24Regular = (props) => <Icon name="graph-up-arrow" {...props} />;
export const Delete24Regular = (props) => <Icon name="trash3" {...props} />;
export const Dismiss24Regular = (props) => <Icon name="x-lg" {...props} />;
export const Edit24Regular = (props) => <Icon name="pencil-square" {...props} />;
export const Home24Regular = (props) => <Icon name="house-door" {...props} />;
export const Key24Regular = (props) => <Icon name="key" {...props} />;
export const MailTemplate24Regular = (props) => <Icon name="envelope-paper" {...props} />;
export const Navigation24Regular = (props) => <Icon name="list" {...props} />;
export const PeopleCheckmark24Regular = (props) => <Icon name="person-check" {...props} />;
export const PeopleCommunity24Regular = (props) => <Icon name="people" {...props} />;
export const Person24Regular = (props) => <Icon name="person" {...props} />;
export const PersonCircle24Regular = (props) => <Icon name="person-circle" {...props} />;
export const Print24Regular = (props) => <Icon name="printer" {...props} />;
export const Save24Regular = (props) => <Icon name="floppy" {...props} />;
export const Search24Regular = (props) => <Icon name="search" {...props} />;
export const SignOut24Regular = (props) => <Icon name="box-arrow-right" {...props} />;
export const WindowApps24Regular = (props) => <Icon name="grid" {...props} />;

export const TeacherIcon = (props) => (
  <svg viewBox="0 0 64 64" fill="currentColor" width="1em" height="1em" {...props}>
    <path d="M32 2a14 14 0 1 0 14 14A14 14 0 0 0 32 2Zm0 24a10 10 0 1 1 10-10 10 10 0 0 1-10 10Zm18 8H14a8 8 0 0 0-8 8v12a2 2 0 0 0 2 2h48a2 2 0 0 0 2-2V42a8 8 0 0 0-8-8ZM10 52V42a4 4 0 0 1 4-4h36a4 4 0 0 1 4 4v10Z"/>
    <path d="M50 14h8v2h-8zM50 20h6v2h-6zM8 14h8v2H8zM8 20h6v2H8z"/>
  </svg>
);

