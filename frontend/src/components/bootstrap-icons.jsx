function Icon({ name, className, ...props }) {
  return <i className={`bi bi-${name}${className ? ` ${className}` : ''}`} {...props} />;
}

export const Add24Regular = (props) => <Icon name="plus-lg" {...props} />;
export const ArrowClockwise24Regular = (props) => <Icon name="arrow-clockwise" {...props} />;
export const ArrowRight24Regular = (props) => <Icon name="arrow-right" {...props} />;
export const Building24Regular = (props) => <Icon name="building" {...props} />;
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

export const TeacherIcon = ({ className = '', style = {}, ...props }) => (
  <img
    src="/teacher-logo.png"
    alt="ClassManager"
    className={className}
    style={{
      width: '1.4em',
      height: '1.4em',
      objectFit: 'contain',
      verticalAlign: 'middle',
      ...style,
    }}
    {...props}
  />
);

