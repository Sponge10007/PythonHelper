// 本地MathJax配置和简化实现
// 由于Chrome扩展V3不允许外部CDN，我们使用本地实现

window.MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    processEscapes: true
  },
  svg: {
    fontCache: 'global'
  },
  startup: {
    ready: () => {
      console.log('本地MathJax已初始化');
      window.MathJax.startup.defaultReady();
    }
  }
};

// 简化的MathJax实现
(function() {
  'use strict';
  
  // 创建基本的MathJax对象结构
  if (!window.MathJax) {
    window.MathJax = {};
  }
  
  // 增强的LaTeX渲染实现
  window.MathJax.typesetPromise = function(elements) {
    return new Promise((resolve, reject) => {
      try {
        const elementsToProcess = elements || [document.body];
        
        elementsToProcess.forEach(element => {
          // 先处理块级公式 $$...$$（必须先处理，避免被行内公式处理）
          element.innerHTML = element.innerHTML.replace(
            /\$\$([\s\S]*?)\$\$/g, 
            (match, formula) => {
              return `<div class="math-display" style="text-align: center; font-family: 'Times New Roman', serif; color: #333; margin: 15px 0; font-size: 1.2em; background: #f8f9fa; padding: 10px; border-radius: 4px; border-left: 4px solid #007bff;">${renderLatexFormula(formula.trim())}</div>`;
            }
          );
          
          // 再处理行内公式 $...$
          element.innerHTML = element.innerHTML.replace(
            /\$([^$\n]+)\$/g, 
            (match, formula) => {
              return `<span class="math-inline" style="font-family: 'Times New Roman', serif; color: #0066cc; font-style: italic; background: #f0f8ff; padding: 2px 4px; border-radius: 3px;">${renderLatexFormula(formula.trim())}</span>`;
            }
          );
        });
        
        resolve();
      } catch (error) {
        console.error('MathJax渲染错误:', error);
        reject(error);
      }
    });
  };
  
  // LaTeX公式渲染函数
  function renderLatexFormula(latex) {
    let rendered = latex;
    
    // 处理常见的LaTeX符号和命令
    const replacements = {
      // 希腊字母
      '\\\\alpha': 'α', '\\\\beta': 'β', '\\\\gamma': 'γ', '\\\\delta': 'δ',
      '\\\\epsilon': 'ε', '\\\\zeta': 'ζ', '\\\\eta': 'η', '\\\\theta': 'θ',
      '\\\\iota': 'ι', '\\\\kappa': 'κ', '\\\\lambda': 'λ', '\\\\mu': 'μ',
      '\\\\nu': 'ν', '\\\\xi': 'ξ', '\\\\pi': 'π', '\\\\rho': 'ρ',
      '\\\\sigma': 'σ', '\\\\tau': 'τ', '\\\\upsilon': 'υ', '\\\\phi': 'φ',
      '\\\\chi': 'χ', '\\\\psi': 'ψ', '\\\\omega': 'ω',
      
      // 大写希腊字母
      '\\\\Gamma': 'Γ', '\\\\Delta': 'Δ', '\\\\Theta': 'Θ', '\\\\Lambda': 'Λ',
      '\\\\Xi': 'Ξ', '\\\\Pi': 'Π', '\\\\Sigma': 'Σ', '\\\\Phi': 'Φ',
      '\\\\Psi': 'Ψ', '\\\\Omega': 'Ω',
      
      // 数学符号
      '\\\\infty': '∞', '\\\\partial': '∂', '\\\\nabla': '∇',
      '\\\\pm': '±', '\\\\mp': '∓', '\\\\times': '×', '\\\\div': '÷',
      '\\\\cdot': '·', '\\\\bullet': '•', '\\\\circ': '∘',
      '\\\\leq': '≤', '\\\\geq': '≥', '\\\\neq': '≠', '\\\\approx': '≈',
      '\\\\equiv': '≡', '\\\\sim': '∼', '\\\\simeq': '≃',
      '\\\\propto': '∝', '\\\\parallel': '∥', '\\\\perp': '⊥',
      '\\\\in': '∈', '\\\\notin': '∉', '\\\\subset': '⊂', '\\\\supset': '⊃',
      '\\\\subseteq': '⊆', '\\\\supseteq': '⊇', '\\\\cup': '∪', '\\\\cap': '∩',
      '\\\\emptyset': '∅', '\\\\forall': '∀', '\\\\exists': '∃',
      '\\\\rightarrow': '→', '\\\\leftarrow': '←', '\\\\leftrightarrow': '↔',
      '\\\\Rightarrow': '⇒', '\\\\Leftarrow': '⇐', '\\\\Leftrightarrow': '⇔',
      
      // 积分和求和
      '\\\\int': '∫', '\\\\iint': '∬', '\\\\iiint': '∭', '\\\\oint': '∮',
      '\\\\sum': '∑', '\\\\prod': '∏', '\\\\coprod': '∐',
      '\\\\bigcup': '⋃', '\\\\bigcap': '⋂',
      
      // 其他符号
      '\\\\sqrt': '√', '\\\\angle': '∠', '\\\\triangle': '△',
      '\\\\square': '□', '\\\\diamond': '◊', '\\\\star': '⋆',
      '\\\\dagger': '†', '\\\\ddagger': '‡', '\\\\S': '§', '\\\\P': '¶'
    };
    
    // 应用基本替换
    for (const [latex, unicode] of Object.entries(replacements)) {
      rendered = rendered.replace(new RegExp(latex, 'g'), unicode);
    }
    
    // 处理上标 ^{}
    rendered = rendered.replace(/\^{([^}]+)}/g, '<sup>$1</sup>');
    rendered = rendered.replace(/\^([a-zA-Z0-9])/g, '<sup>$1</sup>');
    
    // 处理下标 _{}
    rendered = rendered.replace(/_{([^}]+)}/g, '<sub>$1</sub>');
    rendered = rendered.replace(/_([a-zA-Z0-9])/g, '<sub>$1</sub>');
    
    // 处理分数 \frac{}{} 
    rendered = rendered.replace(/\\frac{([^}]+)}{([^}]+)}/g, 
      '<span style="display: inline-block; text-align: center; vertical-align: middle;"><span style="display: block; border-bottom: 1px solid; padding-bottom: 2px;">$1</span><span style="display: block; padding-top: 2px;">$2</span></span>');
    
    // 处理根号 \sqrt{}
    rendered = rendered.replace(/\\sqrt{([^}]+)}/g, '√($1)');
    
    // 处理求和的上下限
    rendered = rendered.replace(/\\sum_{([^}]+)}\^{([^}]+)}/g, 
      '<span style="position: relative; display: inline-block;">∑<sub style="position: absolute; left: 0; bottom: -0.5em;">$1</sub><sup style="position: absolute; left: 0; top: -0.5em;">$2</sup></span>');
    
    // 处理积分的上下限
    rendered = rendered.replace(/\\int_{([^}]+)}\^{([^}]+)}/g, 
      '<span style="position: relative; display: inline-block;">∫<sub style="position: absolute; left: 0; bottom: -0.5em;">$1</sub><sup style="position: absolute; left: 0; top: -0.5em;">$2</sup></span>');
    
    // 清理多余的反斜杠
    rendered = rendered.replace(/\\\\/g, '');
    
    return rendered;
  }
  
  // 兼容MathJax v2的Hub对象
  window.MathJax.Hub = {
    Queue: function(commands) {
      // 简化的队列实现
      commands.forEach(command => {
        if (Array.isArray(command) && command[0] === "Typeset") {
          window.MathJax.typesetPromise([command[2]]);
        }
      });
    }
  };
  
  // 启动函数
  window.MathJax.startup = {
    defaultReady: function() {
      console.log('MathJax本地版本已准备就绪');
    }
  };
  
  // 自动初始化
  if (window.MathJax.startup && window.MathJax.startup.ready) {
    window.MathJax.startup.ready();
  } else {
    window.MathJax.startup.defaultReady();
  }
  
})();
