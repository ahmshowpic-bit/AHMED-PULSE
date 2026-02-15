
export interface Song {
  id: string;
  name: string;
  folder: string;
  image: string;
  url: string;
}

export interface DiaryPost {
  id: string;
  name: string;
  text: string;
  verified: boolean;
  date: string;
  likes: number;
}

export interface ContactMessage {
  id: string;
  name: string;
  msg: string;
}

export interface CustomPage {
  id: string;
  title: string;
  icon: string;
  content: string;
}

export interface AppSettings {
  welcome: string;
  heroMode: boolean;
  heroImg: string;
  heroType: 'image' | 'video';
  bgFit: 'cover' | 'contain';
  animType: 'static' | 'zoom-in' | 'pulse';
  showVisitorCount: boolean;
  bgFilter: 'mode-vivid' | 'mode-dark' | 'mode-blur';
  visitorCount: number;
  defaultSongId: string;
}

export type TabId = 'home' | 'music' | 'diaries' | 'contact' | string;
