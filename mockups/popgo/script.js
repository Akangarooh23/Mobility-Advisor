document.querySelectorAll('.site-header nav a').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelector('.site-header nav')?.classList.remove('open');
  });
});

document.querySelectorAll('a[href="#"]').forEach(a => {
  a.addEventListener('click', e => e.preventDefault());
});

const form = document.querySelector('.newsletter form');
if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const input = form.querySelector('input');
    const button = form.querySelector('button');
    if (!input.value.trim()) return;
    button.textContent = '¡Listo!';
    input.value = '';
    setTimeout(() => button.textContent = 'Suscribirme', 2200);
  });
}
