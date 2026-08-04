import type { ExampleStyle } from '../types';

export const EXAMPLE_STYLES: { value: ExampleStyle; label: string; desc: string }[] = [
  { value: 'exam', label: '考研真题风', desc: '地道考研难度例句（默认）' },
  { value: 'daily', label: '日常简单风', desc: '口语化、常用简单词汇' },
  { value: 'funny', label: '搞笑幽默风', desc: '轻松有趣的例句' },
  { value: 'business', label: '商务职场风', desc: '会议、邮件、谈判场景' },
  { value: 'story', label: '故事叙述风', desc: '像讲故事一样的例句' },
  { value: 'tiktok', label: 'TikTok 短视频风', desc: '博主拍短视频的口语化例句，轻松有网感' },
  { value: 'twitter', label: '推特发文/评论风', desc: '简短观点化的推文/评论风格例句' },
];
