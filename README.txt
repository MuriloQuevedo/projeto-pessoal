Análises do Murilo — Site estático
==================================

🔧 Como atualizar (sem back-end, super simples)
1) Crie sua análise em HTML e salve em: analises/meu-livro.html
   - Dica: copie o arquivo analises/_template.html e edite.
2) Abra data/analises.json e adicione um novo objeto no array "analises", por exemplo:

{
  "slug": "meu-livro",
  "title": "Meu Livro",
  "author": "Nome do Autor",
  "date": "2025-11-03",
  "cover": "",  // URL opcional da capa (pode ser vazia para capa gerada)
  "tags": ["tema1", "tema2"]
}

3) Pronto! O site já lista o livro na página inicial. Clique para abrir a análise.

🖥️ Como publicar grátis
- GitHub Pages: faça um repositório, suba todos os arquivos na raiz e ative Pages.
- Netlify ou Vercel: arraste e solte a pasta em "Deploy site".

📱 Dicas
- As capas são opcionais. Se "cover" estiver vazio, o site gera uma capa com a inicial do título.
- Você pode usar emojis, itálico, negrito e subtítulos normalmente no HTML.
- Para compartilhar uma análise específica, copie o link da página (há um botão "Copiar link").

🧩 Estrutura de pastas
- index.html      => Home e roteamento
- style.css       => Estilos (dark por padrão)
- app.js          => Lógica do site (router, busca, render)
- data/analises.json   => Catálogo das análises
- analises/*.html       => Conteúdo das análises (um arquivo por livro)

✍️ Licença do código
- MIT (use à vontade). Conteúdo dos seus textos, claro, é seu.