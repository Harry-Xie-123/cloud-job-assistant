export const bookmarkletEndpoint = () =>
  `${process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 8080}`}/api/capture/bookmarklet`;

export const buildBookmarklet = () => {
  const endpoint = bookmarkletEndpoint();
  const script = `
    (() => {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = ${JSON.stringify(endpoint)};
      form.style.display = "none";
      const add = (name, value) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value || "";
        form.appendChild(input);
      };
      add("sourceUrl", location.href);
      add("pageTitle", document.title);
      add("listingText", document.body.innerText.slice(0, 30000));
      document.body.appendChild(form);
      form.submit();
    })();
  `;

  return `javascript:${encodeURIComponent(script.replace(/\s+/g, " ").trim())}`;
};
