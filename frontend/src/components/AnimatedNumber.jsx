import React, { useEffect, useRef, useState } from "react";

/**
 * watch değeri değiştiğinde çocuklarını App.css'teki .animate-count
 * (countUp keyframe) ile yeniden oynatır — key değişince React elemanı
 * yeniden monte eder, animasyon böylece tetiklenir. Aynı değer tekrar
 * gelirse (örn. 15sn'lik polling) hiçbir şey olmaz.
 */
export default function AnimatedNumber({ watch, className, as: Tag = "span", ...rest }) {
  const prevRef = useRef(watch);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    if (prevRef.current !== watch) {
      prevRef.current = watch;
      setBump((b) => b + 1);
    }
  }, [watch]);

  return <Tag key={bump} className={className} {...rest} />;
}
