(function () {
  function valueFromEntry(entry, fieldName, fallback) {
    var value = entry.getIn(["data", fieldName]);
    return value || fallback || "";
  }

  function resolveImagePath(imageValue, getAsset) {
    if (!imageValue) return "";
    if (typeof imageValue !== "string") return "";
    if (getAsset) {
      var asset = getAsset(imageValue);
      if (asset) return asset.toString();
    }
    if (/^(https?:)?\/\//.test(imageValue) || imageValue.charAt(0) === "/") {
      return imageValue;
    }
    return "/img/blogs/" + imageValue.replace(/^\/+/, "");
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character];
    });
  }

  function formatDate(dateValue) {
    if (!dateValue) return "Draft";
    var date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return dateValue;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  function renderPreview(h, props) {
    var entry = props.entry;
    var title = valueFromEntry(entry, "title", "Post Title");
    var category = valueFromEntry(entry, "category", "Club News");
    var date = formatDate(valueFromEntry(entry, "date", ""));
    var image = resolveImagePath(valueFromEntry(entry, "image", ""), props.getAsset);
    var body = props.widgetFor("body");

    return h("div", { className: "firelands-preview history-page" }, [
      h("header", { className: "navbar" }, [
        h("div", { className: "logo" }, [
          h("a", { href: "#" }, [
            h("img", { src: "/img/firelands-badge.png", alt: "Firelands United Logo" })
          ])
        ]),
        h("nav", { className: "nav-links" }, [
          h("a", { href: "#" }, "Home"),
          h("a", { href: "#" }, "About"),
          h("a", { href: "#" }, "Men's Team"),
          h("a", { href: "#" }, "Women's Team"),
          h("a", { href: "#", className: "nav-merch" }, [
            h("span", { className: "nav-merch-label" }, "Merch")
          ])
        ])
      ]),
      h("div", { className: "cms-preview-note" },
        "Preview only: layout, typography, featured image, and post body are styled to match the live Firelands blog page."
      ),
      h("div", { className: "blog-hero" }, [
        image
          ? h("img", { src: image, alt: title, className: "blog-hero-image" })
          : h("div", { className: "firelands-preview-placeholder" }, "Featured Image")
      ]),
      h("article", { className: "blog-article" }, [
        h("div", { className: "blog-article-container" }, [
          h("div", { className: "blog-article-meta" }, [
            h("span", { className: "blog-article-category" }, category),
            h("span", { className: "blog-article-date" }, date)
          ]),
          h("h1", { className: "blog-article-title" }, title),
          h("div", { className: "blog-article-body" }, body)
        ])
      ])
    ]);
  }

  function registerFirelandsPreview() {
    if (window.__firelandsPreviewRegistered) return true;
    if (!window.CMS) return false;
    var h = window.h || (window.React && window.React.createElement);
    if (!h) return false;

    window.CMS.registerPreviewStyle("/blog.css");
    window.CMS.registerPreviewStyle("/admin/preview.css");

    var BlogPostPreview = window.createClass
      ? window.createClass({
          render: function () {
            return renderPreview(h, this.props);
          }
        })
      : function (props) {
          return renderPreview(h, props);
        };

    window.CMS.registerPreviewTemplate("posts", BlogPostPreview);
    window.__firelandsPreviewRegistered = true;
    return true;
  }

  function renderEntrySummary(element, parts) {
    var title = parts[0] || "Untitled";
    var date = parts[1] || "Draft";
    var category = parts[2] || "Uncategorized";
    var image = resolveImagePath(parts[3] || "");

    element.innerHTML =
      '<div class="firelands-entry-summary">' +
        '<div class="firelands-entry-summary-thumb">' +
          (image ? '<img src="' + escapeHtml(image) + '" alt="">' : "") +
        '</div>' +
        '<div class="firelands-entry-summary-body">' +
          '<div class="firelands-entry-summary-title">' + escapeHtml(title) + '</div>' +
          '<div class="firelands-entry-summary-meta">' +
            '<span class="firelands-entry-summary-category">' + escapeHtml(category) + '</span>' +
            '<span>' + escapeHtml(date) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function enhanceEntrySummaries() {
    var candidates = document.querySelectorAll("main *:not(script):not(style), [class*='Collection'] *:not(script):not(style)");

    candidates.forEach(function (element) {
      if (element.dataset.firelandsSummary === "true") return;
      if (element.children.length > 0 && !Array.prototype.some.call(element.childNodes, function (node) {
        return node.nodeType === Node.TEXT_NODE && node.textContent.indexOf("|||") !== -1;
      })) {
        return;
      }

      var text = element.textContent.trim();
      if (text.indexOf("|||") === -1) return;

      var parts = text.split("|||");
      if (parts.length < 4) return;

      element.dataset.firelandsSummary = "true";
      renderEntrySummary(element, parts);
    });
  }

  if (!registerFirelandsPreview()) {
    var attempts = 0;
    var timer = window.setInterval(function () {
      attempts += 1;
      if (registerFirelandsPreview() || attempts > 50) {
        window.clearInterval(timer);
      }
    }, 100);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhanceEntrySummaries);
  } else {
    enhanceEntrySummaries();
  }

  window.setInterval(enhanceEntrySummaries, 1000);
})();
