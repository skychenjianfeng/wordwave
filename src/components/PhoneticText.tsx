import { useEffect, useState } from 'react';
import { getIpa } from '../lib/ipa';

interface PhoneticTextProps {
  word: string;
  className?: string;
}

export default function PhoneticText({ word, className }: PhoneticTextProps) {
  const [ipa, setIpa] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setIpa(null);
    void getIpa(word).then((v) => {
      if (alive) setIpa(v);
    });
    return () => {
      alive = false;
    };
  }, [word]);

  if (!ipa) return null;
  return (
    <div data-ipa={ipa} className={className}>
      {ipa}
    </div>
  );
}
