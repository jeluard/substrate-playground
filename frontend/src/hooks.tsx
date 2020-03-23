import { useState, useEffect, useRef } from "react";

export function useHover() {
    const [value, setValue] = useState(false);
    const ref = useRef(null);
  
    const handleMouseOver = () => setValue(true);
    const handleMouseOut = () => setValue(false);
    const config = {childList: true};
    const observer = new MutationObserver(() => setValue(false));
  
    useEffect(
      () => {
        const node = ref.current as unknown as Node;
        if (node) {
          node.addEventListener('mouseover', handleMouseOver);
          node.addEventListener('mouseout', handleMouseOut);
          const parentNode = node.parentNode;
          if (parentNode) {
            observer.observe(parentNode, config);
          }
  
          return () => {
            node.removeEventListener('mouseover', handleMouseOver);
            node.removeEventListener('mouseout', handleMouseOut);
            observer.disconnect();
          };
        }
      },
      [ref.current] // Recall only if ref changes
    );
  
    return [ref, value];
}

export function useWindowMaxDimension() {
    function clientDimension() {return Math.max(document.documentElement.clientWidth, document.documentElement.clientHeight)}
    const [dimension, setDimension] = useState(clientDimension());
    
    useEffect(() => {
        const handleResize = () => setDimension(clientDimension());
        const event = 'resize';
        window.addEventListener(event, handleResize);
        return () => window.removeEventListener(event, handleResize);
    });
    
    return dimension;
}

export function useInterval(callback: () => void, delay: number) {
  const savedCallback = useRef() as MutableRefObject<() => void>;

  useEffect(() => {
    savedCallback.current = callback;
  });

  useEffect(() => {
    function tick() {
      savedCallback.current();
    }

    let id = setInterval(tick, delay);
    return () => clearInterval(id);
  }, [delay]);
}

function useLocalStorage(key: string, initialValue: string) {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState(() => {
    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      // Parse stored json or if none return initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // If error also return initialValue
      console.log(error);
      return initialValue;
    }
  })};